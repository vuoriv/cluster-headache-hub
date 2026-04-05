# Weekly Update Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single `scripts/update-all.py` script that re-fetches PubMed + ClinicalTrials.gov data, re-runs all analyses, rebuilds data.db, and can be triggered weekly via GitHub Actions — keeping the live site up to date.

**Architecture:** One orchestrator script calls existing pipeline scripts in the correct order. A new GitHub Actions workflow runs it weekly (Sunday midnight UTC) and commits the updated data.db automatically. No new analysis logic — reuses everything already built.

**Tech Stack:** Python 3.11+, GitHub Actions, SQLite, existing scripts

---

## Current Pipeline (what exists)

| Step | Script | Input | Output |
|------|--------|-------|--------|
| 1 | `fetch-research.py` | PubMed + ClinicalTrials.gov APIs | `public/data.db` (papers + trials tables) |
| 2 | `analyze-research.py` | `public/data.db` | `src/data/research-insights/*.json` + `paper_analyses` table |
| 3 | `analyze-categories.py` | `public/data.db` + `src/data/trials/trial-analyses.json` | `src/data/research-insights/categories/*.json` |
| 4 | `analyze-forum.py` | `~/projects/clusterbusters/clusterbusters.db` | `src/data/*.json` (forum stats, rankings, etc.) |
| 5 | `analyze-insights.py` | `~/projects/clusterbusters/clusterbusters.db` | `src/data/insights/*.json` |
| 6 | `build-analysis-db.py` | All JSON files in `src/data/` | `data/analysis.db` |
| 7 | Manual merge | `data/analysis.db` + `public/data.db` | `public/data.db` (combined) |

**Key insight:** Steps 4-5 depend on `clusterbusters.db` (252MB) which is NOT in the repo. The weekly update should only re-run steps 1-3 + 6-7 (research data refresh). Forum data changes rarely — that's a separate manual run.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/update-all.py` | Create | Orchestrator: runs pipeline steps in order, handles errors |
| `scripts/build-analysis-db.py` | Modify | Add merge-into-data.db step so it's self-contained |
| `.github/workflows/weekly-update.yml` | Create | Scheduled weekly run + auto-commit |
| `.github/workflows/deploy.yml` | Modify | Trigger deploy after weekly update |

---

### Task 1: Create the orchestrator script

**Files:**
- Create: `scripts/update-all.py`

- [ ] **Step 1: Write the orchestrator**

```python
#!/usr/bin/env python3
"""
Weekly Update Pipeline — fetches fresh data, re-runs analyses, rebuilds DB.

Usage:
  python scripts/update-all.py [--skip-fetch] [--skip-forum]

Phases:
  1. Fetch: PubMed papers + ClinicalTrials.gov trials → public/data.db
  2. Analyze: Classify papers, generate research insights + categories
  3. Merge: Combine analysis tables into public/data.db
  4. (Optional) Forum: Re-analyze ClusterBusters forum data
"""

import argparse
import os
import subprocess
import sys
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DB = os.path.join(PROJECT_ROOT, "public", "data.db")


def run(cmd, description):
    """Run a command, print status, exit on failure."""
    print(f"\n{'='*60}")
    print(f"  {description}")
    print(f"{'='*60}\n")
    result = subprocess.run(
        cmd, cwd=PROJECT_ROOT, shell=isinstance(cmd, str)
    )
    if result.returncode != 0:
        print(f"\n  FAILED: {description}")
        sys.exit(1)
    return result


def main():
    parser = argparse.ArgumentParser(description="Weekly Update Pipeline")
    parser.add_argument("--skip-fetch", action="store_true",
                        help="Skip fetching from APIs (use existing data)")
    parser.add_argument("--skip-forum", action="store_true", default=True,
                        help="Skip forum analysis (requires clusterbusters.db)")
    parser.add_argument("--forum-db", default=None,
                        help="Path to clusterbusters.db for forum analysis")
    args = parser.parse_args()

    start = time.time()
    print("=" * 60)
    print("  CLUSTER HEADACHE HUB — WEEKLY UPDATE")
    print("=" * 60)

    # Phase 1: Fetch fresh research data
    if not args.skip_fetch:
        run(
            [sys.executable, os.path.join(SCRIPT_DIR, "fetch-research.py"),
             "--db", DATA_DB],
            "Phase 1: Fetch PubMed + ClinicalTrials.gov"
        )
    else:
        print("\n  Skipping fetch (--skip-fetch)")

    # Phase 2: Analyze research data
    run(
        [sys.executable, os.path.join(SCRIPT_DIR, "analyze-research.py"),
         "--db", DATA_DB],
        "Phase 2: Analyze papers + trials"
    )

    run(
        [sys.executable, os.path.join(SCRIPT_DIR, "analyze-categories.py")],
        "Phase 2b: Generate per-category analysis"
    )

    # Phase 3: Forum analysis (optional, needs clusterbusters.db)
    forum_db = args.forum_db
    if not args.skip_forum and forum_db and os.path.exists(forum_db):
        run(
            [sys.executable, os.path.join(SCRIPT_DIR, "analyze-forum.py"),
             "--db", forum_db, "--output", os.path.join(PROJECT_ROOT, "src", "data"),
             "--skip-llm"],
            "Phase 3: Analyze forum data"
        )
        run(
            [sys.executable, os.path.join(SCRIPT_DIR, "analyze-insights.py"),
             "--db", forum_db],
            "Phase 3b: Generate community insights"
        )
    else:
        print("\n  Skipping forum analysis (--skip-forum or no forum DB)")

    # Phase 4: Rebuild analysis.db and merge into data.db
    run(
        [sys.executable, os.path.join(SCRIPT_DIR, "build-analysis-db.py")],
        "Phase 4: Rebuild analysis.db"
    )

    # Phase 5: Merge analysis tables into data.db
    run(
        [sys.executable, "-c", f"""
import sqlite3, os
src = sqlite3.connect(os.path.join("{PROJECT_ROOT}", "data", "analysis.db"))
tables = {{}}
for row in src.execute("SELECT name, sql FROM sqlite_master WHERE type='table'"):
    name, sql = row
    rows = src.execute(f"SELECT * FROM {{name}}").fetchall()
    tables[name] = (sql, rows)
src.close()

db = sqlite3.connect("{DATA_DB}")
for name, (sql, rows) in tables.items():
    db.execute(f"DROP TABLE IF EXISTS {{name}}")
    db.execute(sql)
    if rows:
        ph = ",".join(["?"] * len(rows[0]))
        db.executemany(f"INSERT INTO {{name}} VALUES ({{ph}})", rows)
    count = db.execute(f"SELECT COUNT(*) FROM {{name}}").fetchone()[0]
    print(f"  {{name}}: {{count}} rows")
db.commit()
db.close()
print(f"  Merged into {DATA_DB}")
"""],
        "Phase 5: Merge analysis tables into data.db"
    )

    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"  UPDATE COMPLETE in {elapsed:.0f}s")
    print(f"  Output: {DATA_DB} ({os.path.getsize(DATA_DB) / 1024:.0f} KB)")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test locally**

```bash
cd /Users/ville/projects/cluster-headache-hub
python3 scripts/update-all.py --skip-fetch
```

Expected: Phases 2-5 run successfully, data.db updated.

- [ ] **Step 3: Test with full fetch**

```bash
python3 scripts/update-all.py
```

Expected: Full pipeline runs (~3 minutes), data.db refreshed with latest PubMed/ClinicalTrials data.

- [ ] **Step 4: Commit**

```bash
git add scripts/update-all.py
git commit -m "feat: add update-all.py orchestrator for weekly pipeline"
```

---

### Task 2: Create GitHub Actions weekly workflow

**Files:**
- Create: `.github/workflows/weekly-update.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Weekly Data Update

on:
  schedule:
    # Every Sunday at midnight UTC
    - cron: '0 0 * * 0'
  workflow_dispatch:  # Manual trigger

permissions:
  contents: write
  pages: write
  id-token: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install Python dependencies
        run: pip install requests

      - name: Run update pipeline
        run: python scripts/update-all.py --skip-forum

      - name: Check for changes
        id: changes
        run: |
          git diff --quiet public/data.db && echo "changed=false" >> $GITHUB_OUTPUT || echo "changed=true" >> $GITHUB_OUTPUT

      - name: Commit updated data
        if: steps.changes.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/data.db src/data/research-insights/ src/data/trials/
          git commit -m "chore: weekly data update $(date -u +%Y-%m-%d)"
          git push

  deploy:
    needs: update
    if: needs.update.result == 'success'
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: main  # Get the commit from the update job

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm run build

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Step 2: Verify workflow syntax**

```bash
# Check YAML validity
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/weekly-update.yml'))"
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/weekly-update.yml
git commit -m "feat: add weekly data update GitHub Actions workflow"
```

---

### Task 3: Add npm script for local convenience

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add script**

Add to `package.json` scripts:
```json
"update": "python3 scripts/update-all.py",
"update:fetch": "python3 scripts/update-all.py",
"update:analyze": "python3 scripts/update-all.py --skip-fetch"
```

- [ ] **Step 2: Test**

```bash
npm run update:analyze
```

Expected: Runs analysis-only pipeline.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add npm update scripts for pipeline"
```

---

### Task 4: Test full pipeline end-to-end

- [ ] **Step 1: Run full update**

```bash
python3 scripts/update-all.py
```

- [ ] **Step 2: Verify data.db integrity**

```bash
sqlite3 public/data.db "
SELECT 'papers' as tbl, COUNT(*) FROM papers
UNION ALL SELECT 'trials', COUNT(*) FROM trials
UNION ALL SELECT 'paper_analyses', COUNT(*) FROM paper_analyses
UNION ALL SELECT 'treatment_profiles', COUNT(*) FROM treatment_profiles
UNION ALL SELECT 'insights', COUNT(*) FROM insights
UNION ALL SELECT 'community_groups', COUNT(*) FROM community_groups
"
```

Expected: All tables populated with correct counts.

- [ ] **Step 3: Build frontend**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Visual test**

Start dev server and verify all pages load correctly.

- [ ] **Step 5: Final commit and push**

```bash
git add -A
git commit -m "feat: weekly update pipeline — orchestrator + GitHub Actions

Pipeline runs every Sunday midnight UTC:
1. Fetch latest from PubMed (4,400+ papers) + ClinicalTrials.gov (100+ trials)
2. Re-classify all papers (study type, result, evidence tier)
3. Regenerate per-category analysis
4. Rebuild analysis.db and merge into data.db
5. Auto-commit + deploy to GitHub Pages

Manual: python scripts/update-all.py
Local: npm run update (full) or npm run update:analyze (skip fetch)"
git push origin main
```

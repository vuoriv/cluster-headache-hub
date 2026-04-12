# AI-Driven Subcategory Mapping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual TERM_ALIASES map with AI-powered intervention/topic classification, using the existing LLM pipeline's per-paper analysis to drive subcategory assignment.

**Architecture:** Update `llm-analyze.py` PAPER_PROMPT to return `primary_interventions`, `comparator_interventions`, and `topics`. Add `pa_analyses` columns for these. Rewrite `build_subcategories` to read from AI output instead of static maps. Add error tracking table. Reorder pipeline so subcategories build after LLM analysis.

**Tech Stack:** Python 3, SQLite, Cerebras/Qwen3 API (OpenAI-compatible)

**Spec:** `docs/superpowers/specs/2026-04-12-ai-subcategory-mapping-design.md`

---

### Task 1: Update pa_analyses schema and PAPER_PROMPT

**Files:**
- Modify: `scripts/llm-analyze.py`

- [ ] **Step 1: Add new columns to ensure_pa_analyses_table**

In `scripts/llm-analyze.py`, update `ensure_pa_analyses_table` (line 33-47) to add the new columns:

```python
def ensure_pa_analyses_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pa_analyses (
            pmid TEXT PRIMARY KEY,
            outcome TEXT,
            plain_summary TEXT,
            key_finding TEXT,
            sample_size INTEGER,
            study_type TEXT,
            evidence_tier INTEGER,
            interventions_studied TEXT,
            analysis_source TEXT DEFAULT 'ai',
            primary_interventions TEXT,
            comparator_interventions TEXT,
            topics TEXT
        )
    """)
    # Add columns if table already exists (migration)
    for col, coltype in [
        ("primary_interventions", "TEXT"),
        ("comparator_interventions", "TEXT"),
        ("topics", "TEXT"),
    ]:
        try:
            conn.execute(f"ALTER TABLE pa_analyses ADD COLUMN {col} {coltype}")
        except Exception:
            pass  # Column already exists
    conn.commit()
```

- [ ] **Step 2: Update PAPER_PROMPT**

Replace the PAPER_PROMPT (line 114-148) with:

```python
PAPER_PROMPT = """You are analyzing a research paper about cluster headache. Based on the content below, provide a structured analysis written for patients, not doctors.

Title: {title}
Authors: {authors}
Journal: {journal} ({year})
Category: {category}
MeSH Terms: {mesh_terms}

Content:
{content}

Respond with ONLY a JSON object (no markdown, no explanation):
{{
  "outcome": "showed_benefit|no_benefit|mixed|inconclusive|basic_science",
  "plain_summary": "2-3 sentence explanation of what was studied and found, written for a CH patient with no medical background",
  "key_finding": "single sentence - the most important result with numbers if available",
  "sample_size": null,
  "study_type": "rct|observational|case_report|review|meta_analysis|basic_science|other",
  "evidence_tier": 3,
  "interventions_studied": ["treatment1"],
  "primary_interventions": ["Treatment Name"],
  "comparator_interventions": ["Placebo"],
  "topics": []
}}

Evidence tier guide:
1 = meta-analysis or systematic review combining multiple studies
2 = randomized controlled trial (RCT)
3 = observational study or cohort
4 = case series (multiple patients, no control)
5 = case report, editorial, basic science, or lab research

For outcome:
- showed_benefit = the treatment clearly helped patients
- no_benefit = the treatment did not help
- mixed = some benefit but not convincing
- inconclusive = results unclear or too early
- basic_science = no treatment was tested (lab research, imaging, genetics)

For primary_interventions:
- Treatments/interventions THIS PAPER ACTUALLY STUDIES or evaluates
- Use canonical drug names (e.g., "Psilocybin" not "psilocybin mushroom", "LSD" not "lysergic acid diethylamide")
- Empty array if no specific treatment is studied (e.g., epidemiology paper)

For comparator_interventions:
- Treatments mentioned as controls, alternatives, or background context
- NOT the focus of the study — just referenced for comparison
- e.g., a psilocybin study that compares against verapamil: primary=["Psilocybin"], comparator=["Verapamil", "Placebo"]

For topics:
- Non-treatment research themes: epidemiology, quality of life, sleep, comorbidity, genetics, chronobiology, depression, anxiety, diagnosis, prevalence, gender differences, smoking, alcohol, suicide, disability, classification, exercise, photophobia
- Only include if the topic is a MAIN FOCUS of the paper, not just mentioned
- Empty array for treatment-focused papers"""
```

- [ ] **Step 3: Update the INSERT in analyze_papers to store new fields**

In `analyze_papers` function (line 244-256), update the INSERT to include new columns:

```python
            conn.execute(
                "INSERT OR REPLACE INTO pa_analyses (pmid, outcome, plain_summary, key_finding, sample_size, study_type, evidence_tier, interventions_studied, analysis_source, primary_interventions, comparator_interventions, topics) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    pmid,
                    result.get("outcome", "inconclusive"),
                    result.get("plain_summary"),
                    result.get("key_finding"),
                    result.get("sample_size"),
                    result.get("study_type", "other"),
                    result.get("evidence_tier", 5),
                    json.dumps(result.get("interventions_studied", [])),
                    "ai",
                    json.dumps(result.get("primary_interventions", [])),
                    json.dumps(result.get("comparator_interventions", [])),
                    json.dumps(result.get("topics", [])),
                ),
            )
```

- [ ] **Step 4: Add retry logic and error tracking**

Add the error table function near the top of the file (after `ensure_tr_analyses_table`):

```python
def ensure_analysis_errors_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS rs_analysis_errors (
            id TEXT PRIMARY KEY,
            error TEXT,
            timestamp TEXT,
            retry_count INTEGER DEFAULT 0
        )
    """)
    conn.commit()
```

Update the error handling in the `analyze_papers` loop (line 261-262) to retry once and track errors:

```python
        try:
            result = call_llm(prompt, api_key, base_url, model)
        except Exception as e:
            # Retry once after 2s
            try:
                time.sleep(2)
                result = call_llm(prompt, api_key, base_url, model)
            except Exception as e2:
                ensure_analysis_errors_table(conn)
                conn.execute(
                    "INSERT OR REPLACE INTO rs_analysis_errors (id, error, timestamp, retry_count) VALUES (?, ?, datetime('now'), COALESCE((SELECT retry_count FROM rs_analysis_errors WHERE id = ?), 0) + 1)",
                    (pmid, str(e2), pmid),
                )
                conn.commit()
                print(f"    Error analyzing PMID {pmid} (retry failed): {e2}", flush=True)
                time.sleep(1)
                continue

        # Validate required fields
        if not isinstance(result, dict):
            print(f"    Warning: PMID {pmid} returned non-dict, skipping", flush=True)
            continue

        conn.execute(
            "INSERT OR REPLACE INTO pa_analyses (pmid, outcome, plain_summary, key_finding, sample_size, study_type, evidence_tier, interventions_studied, analysis_source, primary_interventions, comparator_interventions, topics) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                pmid,
                result.get("outcome", "inconclusive"),
                result.get("plain_summary"),
                result.get("key_finding"),
                result.get("sample_size"),
                result.get("study_type", "other"),
                result.get("evidence_tier", 5),
                json.dumps(result.get("interventions_studied", [])),
                "ai",
                json.dumps(result.get("primary_interventions", [])),
                json.dumps(result.get("comparator_interventions", [])),
                json.dumps(result.get("topics", [])),
            ),
        )
        conn.commit()

        # Clear error if previously failed
        conn.execute("DELETE FROM rs_analysis_errors WHERE id = ?", (pmid,))

        if (i + 1) % 50 == 0:
            print(f"    Analyzed {i + 1}/{len(new_papers)} papers", flush=True)

        time.sleep(1)
```

- [ ] **Step 5: Retry previously failed papers at start of analyze_papers**

At the start of `analyze_papers`, after getting `existing`, re-queue papers that had errors:

```python
    # Re-queue previously failed papers for retry
    ensure_analysis_errors_table(conn)
    failed_pmids = set(
        r[0] for r in conn.execute("SELECT id FROM rs_analysis_errors WHERE retry_count < 3").fetchall()
    )
    if failed_pmids:
        print(f"  Retrying {len(failed_pmids)} previously failed papers", flush=True)
        existing -= failed_pmids
```

- [ ] **Step 6: Add error summary at end of analyze_papers**

Before the final print, add:

```python
    error_count = conn.execute("SELECT COUNT(*) FROM rs_analysis_errors").fetchone()[0]
    if error_count:
        print(f"  Warning: {error_count} papers have analysis errors (see rs_analysis_errors table)", flush=True)
```

- [ ] **Step 7: Verify syntax**

```bash
python -c "import py_compile; py_compile.compile('scripts/llm-analyze.py', doraise=True)"
```

- [ ] **Step 8: Commit**

```bash
git add scripts/llm-analyze.py
git commit -m "feat: add primary/comparator interventions and topics to paper analysis prompt"
```

---

### Task 2: Rewrite build_subcategories to use AI data

**Files:**
- Modify: `scripts/analyze-research.py`

- [ ] **Step 1: Replace build_subcategories function**

Replace the entire `build_subcategories` function and the TERM_ALIASES, SKIP_TERMS, etc. constants above it (from line ~497 to ~760) with:

```python
def build_subcategories(conn):
    """Build rs_subcategories table from AI-classified paper interventions/topics.

    Reads primary_interventions and topics from pa_analyses (populated by
    llm-analyze.py). Each term is assigned to the category where it appears
    as a primary intervention/topic most often.
    """
    conn.execute("DROP TABLE IF EXISTS rs_subcategories")
    conn.execute("""
        CREATE TABLE rs_subcategories (
            category TEXT NOT NULL,
            term TEXT NOT NULL,
            paper_count INTEGER NOT NULL DEFAULT 0,
            trial_count INTEGER NOT NULL DEFAULT 0,
            search_terms TEXT NOT NULL DEFAULT '[]',
            PRIMARY KEY (category, term)
        )
    """)

    # Check if AI analyses exist
    has_ai = False
    try:
        count = conn.execute(
            "SELECT COUNT(*) FROM pa_analyses WHERE primary_interventions IS NOT NULL"
        ).fetchone()[0]
        has_ai = count > 0
    except Exception:
        pass

    if not has_ai:
        print("  Skipping subcategories: no AI analyses with primary_interventions found", flush=True)
        print("  Run llm-analyze.py first to populate AI analyses", flush=True)
        return

    categories = [r[0] for r in conn.execute(
        "SELECT DISTINCT category FROM pa_papers WHERE category IS NOT NULL "
        "UNION SELECT DISTINCT category FROM tr_trials WHERE category IS NOT NULL "
        "ORDER BY category"
    ).fetchall()]

    # Collect canonical → raw term mappings for search_terms
    # For each paper, map its raw MeSH/keywords to the AI-assigned canonical names
    canonical_to_raw = defaultdict(set)

    # First pass: collect term counts per category from AI analyses
    all_data = {}
    for cat in categories:
        term_paper_counts = Counter()

        for (pmid, pi_json, topics_json, mesh_json, kw_json) in conn.execute(
            """SELECT a.pmid, a.primary_interventions, a.topics, p.mesh_terms, p.author_keywords
               FROM pa_analyses a
               JOIN pa_papers p ON a.pmid = p.pmid
               WHERE p.category = ? AND a.primary_interventions IS NOT NULL""",
            (cat,),
        ).fetchall():
            canonical_terms = set()

            # Primary interventions
            try:
                for term in json.loads(pi_json or "[]"):
                    t = term.strip()
                    if t:
                        canonical_terms.add(t)
            except Exception:
                pass

            # Topics (for observational/non-pharma categories)
            try:
                for term in json.loads(topics_json or "[]"):
                    t = term.strip()
                    if t:
                        canonical_terms.add(t)
            except Exception:
                pass

            # Build canonical → raw MeSH/keyword mapping for search_terms
            raw_terms = set()
            for raw_json in (mesh_json, kw_json):
                if not raw_json:
                    continue
                try:
                    for t in json.loads(raw_json):
                        raw_terms.add(t.lower().strip())
                except Exception:
                    pass

            for canonical in canonical_terms:
                term_paper_counts[canonical] += 1
                # Map raw terms to this canonical name
                canonical_to_raw[canonical.lower()].update(raw_terms)

        # Trial interventions: normalize against known canonical names
        term_trial_counts = Counter()
        known_canonical = {t.lower(): t for t in term_paper_counts.keys()}

        for (interv_json,) in conn.execute(
            "SELECT interventions FROM tr_trials WHERE category = ?", (cat,)
        ).fetchall():
            if not interv_json:
                continue
            try:
                for intervention in json.loads(interv_json):
                    low = intervention.lower().strip()
                    # Check if this intervention matches a known canonical name
                    if low in known_canonical:
                        term_trial_counts[known_canonical[low]] += 1
                    else:
                        # Check if any canonical name is contained in the intervention
                        for canon_low, canon in known_canonical.items():
                            if canon_low in low or low in canon_low:
                                term_trial_counts[canon] += 1
                                break
            except Exception:
                pass

        all_data[cat] = (term_paper_counts, term_trial_counts)

    # Second pass: assign each term to its primary category (highest count)
    term_totals = defaultdict(lambda: defaultdict(int))
    for cat, (tpc, ttc) in all_data.items():
        for term in set(tpc) | set(ttc):
            term_totals[term][cat] = tpc.get(term, 0) + ttc.get(term, 0)

    term_primary = {}
    for term, cat_counts in term_totals.items():
        term_primary[term] = max(cat_counts, key=cat_counts.get)

    # Third pass: insert terms assigned to their primary category
    total_rows = 0
    for cat, (tpc, ttc) in all_data.items():
        for term in set(tpc) | set(ttc):
            if term_primary[term] != cat:
                continue
            # Build search_terms from raw MeSH/keyword mappings
            raw = canonical_to_raw.get(term.lower(), set())
            # Include the canonical name itself (lowercased) for matching
            search = sorted(raw | {term.lower()})
            conn.execute(
                "INSERT INTO rs_subcategories (category, term, paper_count, trial_count, search_terms) VALUES (?, ?, ?, ?, ?)",
                (cat, term, tpc.get(term, 0), ttc.get(term, 0), json.dumps(search)),
            )
            total_rows += 1

    conn.commit()
    print(f"  Built subcategories: {total_rows} terms across {len(categories)} categories (AI-driven)", flush=True)
```

- [ ] **Step 2: Remove the old constants**

Delete TERM_ALIASES dict, SKIP_TERMS set, and their imports/usages (everything from ~line 497 to ~line 644). The `build_subcategories` function should be the only thing remaining in that section.

Note: keep `from collections import Counter, defaultdict` import at the top — it's still needed.

- [ ] **Step 3: Verify syntax**

```bash
python -c "import py_compile; py_compile.compile('scripts/analyze-research.py', doraise=True)"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/analyze-research.py
git commit -m "feat: rewrite build_subcategories to use AI-classified interventions/topics"
```

---

### Task 3: Reorder pipeline so subcategories build after LLM analysis

**Files:**
- Modify: `scripts/update-all.py`
- Modify: `scripts/analyze-research.py`

- [ ] **Step 1: Extract build_subcategories into a standalone callable**

In `scripts/analyze-research.py`, update the `main()` function to accept a `--skip-subcategories` flag:

```python
def main():
    parser = argparse.ArgumentParser(description="Deep Research Analysis")
    parser.add_argument("--db", default=DEFAULT_DB)
    parser.add_argument("--skip-subcategories", action="store_true",
                        help="Skip building subcategories (done separately after LLM analysis)")
    parser.add_argument("--only-subcategories", action="store_true",
                        help="Only build subcategories (run after LLM analysis)")
    args = parser.parse_args()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if args.only_subcategories:
        conn = sqlite3.connect(args.db)
        build_subcategories(conn)
        conn.close()
        return

    print("=== Deep Research Analysis ===\n", flush=True)

    # Analyze papers
    paper_data = analyze_papers(args.db)
    store_analyses(args.db, paper_data["papers"])

    # Cross-linking and stats aggregation
    conn = sqlite3.connect(args.db)
    build_paper_trial_links(conn)
    build_category_stats(conn)
    if not args.skip_subcategories:
        build_subcategories(conn)
    build_global_stats(conn)
    conn.close()

    # Analyze trials
    trial_data = analyze_trials(args.db)

    # Write insight files
    with open(os.path.join(OUTPUT_DIR, "paper-stats.json"), "w") as f:
        json.dump(paper_data["stats"], f, indent=2)
    print(f"\n  Wrote paper-stats.json", flush=True)

    with open(os.path.join(OUTPUT_DIR, "trial-stats.json"), "w") as f:
        json.dump(trial_data, f, indent=2)
    print(f"  Wrote trial-stats.json", flush=True)

    print("\n=== Analysis Complete ===", flush=True)
```

- [ ] **Step 2: Update update-all.py pipeline order**

In `scripts/update-all.py`, update the pipeline to:
1. Run `analyze-research.py --skip-subcategories` (Phase 2a)
2. Run `llm-analyze.py` (Phase 3.5 — moved before Phase 4)
3. Run `analyze-research.py --only-subcategories` (new Phase 3.6)

Replace lines 92-126 with:

```python
    # Phase 2: Classify papers with regex (study type, result, evidence tier)
    run(
        [sys.executable, os.path.join(SCRIPT_DIR, "analyze-research.py"),
         "--db", DATA_DB, "--skip-subcategories"],
        "Phase 2: Classify papers (regex analysis, category stats)",
    )

    # Phase 3: Forum analysis (optional — needs clusterbusters.db)
    if args.forum_db and os.path.exists(args.forum_db):
        run(
            [sys.executable, os.path.join(SCRIPT_DIR, "analyze-forum.py"),
             "--db", args.forum_db,
             "--output", os.path.join(PROJECT_ROOT, "src", "data"),
             "--skip-llm"],
            "Phase 3a: Analyze forum data (stages 1-3)",
        )
        run(
            [sys.executable, os.path.join(SCRIPT_DIR, "analyze-insights.py"),
             "--db", args.forum_db],
            "Phase 3b: Generate community insights",
        )
    else:
        print("\n  Skipping forum analysis (no --forum-db provided)")

    # Phase 4: LLM analysis of papers and trials (if API key available)
    api_key = os.environ.get("CEREBRAS_API_KEY")
    if api_key:
        run(
            [sys.executable, os.path.join(SCRIPT_DIR, "llm-analyze.py")],
            "Phase 4: LLM analysis of papers and trials (Cerebras/Qwen3)",
        )
    else:
        print("\n  Skipping LLM analysis (no CEREBRAS_API_KEY set)")

    # Phase 5: Build subcategories (uses AI data from Phase 4)
    run(
        [sys.executable, os.path.join(SCRIPT_DIR, "analyze-research.py"),
         "--db", DATA_DB, "--only-subcategories"],
        "Phase 5: Build subcategories from AI analyses",
    )
```

Also update Phase 4 (rebuild analysis.db) and Phase 5 (merge) numbering to Phase 6 and Phase 7.

- [ ] **Step 3: Verify syntax**

```bash
python -c "import py_compile; py_compile.compile('scripts/update-all.py', doraise=True)"
python -c "import py_compile; py_compile.compile('scripts/analyze-research.py', doraise=True)"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/update-all.py scripts/analyze-research.py
git commit -m "feat: reorder pipeline so subcategories build after LLM analysis"
```

---

### Task 4: Run full AI analysis and verify

**Files:** None (execution only)

- [ ] **Step 1: Check current AI analysis coverage**

```bash
cd /Users/ville/projects/cluster-headache-hub
sqlite3 public/data.db "SELECT COUNT(*) FROM pa_papers"
sqlite3 public/data.db "SELECT COUNT(*) FROM pa_analyses WHERE analysis_source = 'ai'"
sqlite3 public/data.db "SELECT COUNT(*) FROM pa_analyses WHERE primary_interventions IS NOT NULL"
```

This shows how many papers need AI analysis.

- [ ] **Step 2: Run LLM analysis on all papers**

```bash
python scripts/llm-analyze.py --db public/data.db
```

This will process all papers without AI analysis. Expected: ~4400 API calls, ~1-2 hours with 1s delay between calls. Monitor progress via the "Analyzed X/Y papers" output.

- [ ] **Step 3: Verify AI analysis populated new fields**

```bash
sqlite3 public/data.db "SELECT COUNT(*) FROM pa_analyses WHERE primary_interventions IS NOT NULL"
sqlite3 public/data.db "SELECT primary_interventions, topics FROM pa_analyses WHERE primary_interventions IS NOT NULL LIMIT 5"
```

- [ ] **Step 4: Build subcategories from AI data**

```bash
python scripts/analyze-research.py --db public/data.db --only-subcategories
```

- [ ] **Step 5: Verify subcategory quality**

```bash
sqlite3 public/data.db "SELECT category, COUNT(*) FROM rs_subcategories GROUP BY category ORDER BY COUNT(*) DESC"
```

Spot-check key categories:

```bash
sqlite3 public/data.db "SELECT term, paper_count, trial_count FROM rs_subcategories WHERE category = 'psychedelic' ORDER BY paper_count + trial_count DESC"
sqlite3 public/data.db "SELECT term, paper_count, trial_count FROM rs_subcategories WHERE category = 'pharmacology' ORDER BY paper_count + trial_count DESC LIMIT 20"
sqlite3 public/data.db "SELECT term, paper_count, trial_count FROM rs_subcategories WHERE category = 'observational' ORDER BY paper_count + trial_count DESC LIMIT 20"
```

Verify:
- Psychedelic shows Psilocybin, LSD, Ketamine — not Verapamil
- Pharmacology shows Lithium, Verapamil, Melatonin — not Epidemiology
- Observational shows topic terms like Depression, Sleep, Comorbidity

- [ ] **Step 6: Test in browser**

Open `http://localhost:5175/cluster-headache-hub/research/category/psychedelic` and verify:
1. Dropdown shows correct psychedelic treatments
2. Filtering works — counts match dropdown numbers
3. Stats/charts update with filter

- [ ] **Step 7: Check error table**

```bash
sqlite3 public/data.db "SELECT COUNT(*) FROM rs_analysis_errors"
sqlite3 public/data.db "SELECT * FROM rs_analysis_errors LIMIT 5"
```

- [ ] **Step 8: Commit data**

```bash
git add public/data.db
git commit -m "feat: AI-analyzed subcategories for all papers"
```

---

### Task 5: Clean up old code

**Files:**
- Modify: `scripts/analyze-research.py`

- [ ] **Step 1: Remove TERM_ALIASES, SKIP_TERMS, and related constants**

Delete the following from `scripts/analyze-research.py`:
- `TERM_ALIASES` dict (was ~line 497-578)
- `SKIP_TERMS` set (was ~line 580-644)
- Any remaining references to these in the file

Verify the old constants are fully removed:

```bash
grep -n "TERM_ALIASES\|SKIP_TERMS\|TOPIC_TERMS\|TOPIC_CATS\|DEPRIORITIZED_CATS\|reverse_aliases" scripts/analyze-research.py
```

Expected: no matches (all removed as part of the new `build_subcategories` in Task 2).

- [ ] **Step 2: Verify everything still works**

```bash
python -c "import py_compile; py_compile.compile('scripts/analyze-research.py', doraise=True)"
python scripts/analyze-research.py --db public/data.db --only-subcategories
```

- [ ] **Step 3: Commit**

```bash
git add scripts/analyze-research.py
git commit -m "chore: remove static TERM_ALIASES and SKIP_TERMS maps"
```

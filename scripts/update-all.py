#!/usr/bin/env python3
"""
Weekly Update Pipeline — fetches fresh data, re-runs analyses, rebuilds DB.

Usage:
  python scripts/update-all.py                    # Full update (fetch + analyze)
  python scripts/update-all.py --skip-fetch        # Analyze only (use existing data)
  python scripts/update-all.py --forum-db PATH     # Include forum re-analysis
"""

import argparse
import os
import sqlite3
import subprocess
import sys
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DB = os.path.join(PROJECT_ROOT, "public", "data.db")
ANALYSIS_DB = os.path.join(PROJECT_ROOT, "data", "analysis.db")


def run(cmd, description):
    """Run a command, print status, exit on failure."""
    print(f"\n{'='*60}")
    print(f"  {description}")
    print(f"{'='*60}\n")
    result = subprocess.run(cmd, cwd=PROJECT_ROOT)
    if result.returncode != 0:
        print(f"\n  FAILED: {description}")
        sys.exit(1)


def merge_analysis_into_data():
    """Merge all analysis tables from analysis.db into data.db."""
    print(f"\n{'='*60}")
    print(f"  Merging analysis.db → data.db")
    print(f"{'='*60}\n")

    if not os.path.exists(ANALYSIS_DB):
        print(f"  ERROR: {ANALYSIS_DB} not found")
        sys.exit(1)

    src = sqlite3.connect(ANALYSIS_DB)
    tables = {}
    for row in src.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"):
        name, create_sql = row
        rows = src.execute(f"SELECT * FROM {name}").fetchall()
        tables[name] = (create_sql, rows)
    src.close()

    db = sqlite3.connect(DATA_DB)
    for name, (create_sql, rows) in tables.items():
        db.execute(f"DROP TABLE IF EXISTS {name}")
        db.execute(create_sql)
        if rows:
            placeholders = ",".join(["?"] * len(rows[0]))
            db.executemany(f"INSERT INTO {name} VALUES ({placeholders})", rows)
        count = db.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
        print(f"  {name}: {count} rows")
    db.commit()
    db.close()

    size_kb = os.path.getsize(DATA_DB) / 1024
    print(f"\n  data.db updated ({size_kb:.0f} KB)")


def main():
    parser = argparse.ArgumentParser(description="Weekly Update Pipeline")
    parser.add_argument("--skip-fetch", action="store_true",
                        help="Skip API fetching (reuse existing data)")
    parser.add_argument("--forum-db", default=None,
                        help="Path to clusterbusters.db for forum re-analysis")
    args = parser.parse_args()

    start = time.time()
    print("\n" + "=" * 60)
    print("  CLUSTER HEADACHE HUB — WEEKLY UPDATE")
    print("=" * 60)

    # Phase 1: Fetch fresh research data from APIs
    if not args.skip_fetch:
        run(
            [sys.executable, os.path.join(SCRIPT_DIR, "fetch-research.py"),
             "--db", DATA_DB],
            "Phase 1: Fetch PubMed + ClinicalTrials.gov",
        )
    else:
        print("\n  Skipping fetch (--skip-fetch)")

    # Phase 2: Classify papers and generate research insights
    run(
        [sys.executable, os.path.join(SCRIPT_DIR, "analyze-research.py"),
         "--db", DATA_DB],
        "Phase 2a: Classify papers (study type, result, evidence tier)",
    )

    # Phase 2b: Category stats now built by analyze-research.py (rs_category_stats table)

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

    # Phase 3.5: LLM analysis of new trials (if API key available)
    api_key = os.environ.get("CEREBRAS_API_KEY")
    if api_key:
        run(
            [sys.executable, os.path.join(SCRIPT_DIR, "llm-analyze.py")],
            "Phase 3.5: LLM analysis of new trials (Cerebras/Qwen3)",
        )
    else:
        print("\n  Skipping LLM analysis (no CEREBRAS_API_KEY set)")

    # Phase 4: Rebuild analysis.db from all JSON files
    run(
        [sys.executable, os.path.join(SCRIPT_DIR, "build-analysis-db.py")],
        "Phase 4: Rebuild analysis.db from JSON",
    )

    # Phase 5: Merge analysis tables into data.db
    merge_analysis_into_data()

    # Summary
    elapsed = time.time() - start
    db = sqlite3.connect(DATA_DB)
    papers = db.execute("SELECT COUNT(*) FROM pa_papers").fetchone()[0]
    trials = db.execute("SELECT COUNT(*) FROM tr_trials").fetchone()[0]
    tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    db.close()

    print(f"\n{'='*60}")
    print(f"  UPDATE COMPLETE in {elapsed:.0f}s")
    print(f"  Papers: {papers} | Trials: {trials} | Tables: {len(tables)}")
    print(f"  Output: {DATA_DB} ({os.path.getsize(DATA_DB)/1024:.0f} KB)")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()

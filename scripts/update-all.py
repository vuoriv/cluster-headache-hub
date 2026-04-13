#!/usr/bin/env python3
"""
Weekly Update Pipeline — fetches fresh data, re-runs analyses, rebuilds DB.

Usage:
  python scripts/update-all.py                    # Full update (fetch + analyze)
  python scripts/update-all.py --skip-fetch        # Analyze only (use existing data)
  python scripts/update-all.py --forum-db PATH     # Include forum re-analysis
"""

import argparse
import json
import os
import sqlite3
import subprocess
import sys
import time
import uuid

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DB = os.path.join(PROJECT_ROOT, "public", "data.db")


def ensure_pipeline_runs_table(db_path):
    """Create rs_pipeline_runs table if it doesn't exist."""
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS rs_pipeline_runs (
            run_id TEXT PRIMARY KEY,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            status TEXT NOT NULL DEFAULT 'running',
            error_message TEXT,
            phases_completed TEXT NOT NULL DEFAULT '[]',
            papers_analyzed INTEGER DEFAULT 0,
            trials_analyzed INTEGER DEFAULT 0,
            forum_posts_analyzed INTEGER DEFAULT 0,
            trigger TEXT,
            log TEXT DEFAULT ''
        )
    """)
    conn.commit()
    conn.close()


def update_run(db_path, run_id, **kwargs):
    """Update a pipeline run record."""
    conn = sqlite3.connect(db_path)
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    conn.execute(f"UPDATE rs_pipeline_runs SET {sets} WHERE run_id = ?",
                 [*kwargs.values(), run_id])
    conn.commit()
    conn.close()


def append_log(db_path, run_id, text):
    """Append text to the run's log column."""
    conn = sqlite3.connect(db_path)
    conn.execute("UPDATE rs_pipeline_runs SET log = log || ? WHERE run_id = ?",
                 (text, run_id))
    conn.commit()
    conn.close()


def run(cmd, description, db_path=None, run_id=None, phases=None):
    """Run a command, capture output, log to DB, exit on failure."""
    print(f"\n{'='*60}")
    print(f"  {description}")
    print(f"{'='*60}\n")

    result = subprocess.run(
        cmd, cwd=PROJECT_ROOT,
        env={"PYTHONUNBUFFERED": "1", **os.environ},
        capture_output=True, text=True,
    )

    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)

    if db_path and run_id:
        log_entry = f"\n{'='*60}\n  {description}\n{'='*60}\n"
        if result.stdout:
            log_entry += result.stdout
        if result.stderr:
            log_entry += f"\n[STDERR]\n{result.stderr}"
        append_log(db_path, run_id, log_entry)

        if phases is not None and result.returncode == 0:
            phases.append(description)
            update_run(db_path, run_id, phases_completed=json.dumps(phases))

    if result.returncode != 0:
        error_msg = f"FAILED: {description}"
        print(f"\n  {error_msg}")
        if db_path and run_id:
            update_run(db_path, run_id,
                       status="failure",
                       error_message=f"{error_msg}\n{result.stderr[-500:] if result.stderr else ''}",
                       finished_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                       phases_completed=json.dumps(phases or []))
        sys.exit(1)



def main():
    parser = argparse.ArgumentParser(description="Weekly Update Pipeline")
    parser.add_argument("--skip-fetch", action="store_true",
                        help="Skip API fetching (reuse existing data)")
    parser.add_argument("--forum-db", default=None,
                        help="Path to clusterbusters.db for forum re-analysis")
    args = parser.parse_args()

    start = time.time()
    run_id = str(uuid.uuid4())[:8] + "-" + time.strftime("%Y%m%d-%H%M%S")
    phases = []

    # Detect trigger type
    trigger = "manual"
    if os.environ.get("GITHUB_EVENT_NAME") == "schedule":
        trigger = "schedule"
    elif os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch":
        trigger = "workflow_dispatch"

    # Initialize run tracking
    ensure_pipeline_runs_table(DATA_DB)
    conn = sqlite3.connect(DATA_DB)
    conn.execute(
        "INSERT INTO rs_pipeline_runs (run_id, started_at, status, trigger, phases_completed, log) VALUES (?, ?, 'running', ?, '[]', '')",
        (run_id, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), trigger),
    )
    conn.commit()
    conn.close()

    print("\n" + "=" * 60)
    print("  CLUSTER HEADACHE HUB — WEEKLY UPDATE")
    print(f"  Run ID: {run_id}")
    print("=" * 60)

    try:
        # Phase 1: Fetch fresh research data from APIs
        if not args.skip_fetch:
            run(
                [sys.executable, os.path.join(SCRIPT_DIR, "fetch-research.py"),
                 "--db", DATA_DB],
                "Phase 1: Fetch PubMed + ClinicalTrials.gov",
                db_path=DATA_DB, run_id=run_id, phases=phases,
            )
        else:
            print("\n  Skipping fetch (--skip-fetch)")
            phases.append("Phase 1: Skipped (--skip-fetch)")

        # Phase 2: Classify papers with regex
        run(
            [sys.executable, os.path.join(SCRIPT_DIR, "analyze-research.py"),
             "--db", DATA_DB, "--skip-subcategories"],
            "Phase 2: Classify papers (regex analysis, category stats)",
            db_path=DATA_DB, run_id=run_id, phases=phases,
        )

        # Phase 3: Forum analysis (optional)
        if args.forum_db and os.path.exists(args.forum_db):
            run(
                [sys.executable, os.path.join(SCRIPT_DIR, "analyze-forum.py"),
                 "--db", args.forum_db,
                 "--output", os.path.join(PROJECT_ROOT, "src", "data"),
                 "--skip-llm"],
                "Phase 3a: Analyze forum data (stages 1-3)",
                db_path=DATA_DB, run_id=run_id, phases=phases,
            )
            run(
                [sys.executable, os.path.join(SCRIPT_DIR, "analyze-insights.py"),
                 "--db", args.forum_db],
                "Phase 3b: Generate community insights",
                db_path=DATA_DB, run_id=run_id, phases=phases,
            )
        else:
            print("\n  Skipping forum analysis (no --forum-db provided)")

        # Phase 4: LLM analysis
        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GROQ_API_KEY") or os.environ.get("CEREBRAS_API_KEY")
        if api_key:
            run(
                [sys.executable, os.path.join(SCRIPT_DIR, "llm-analyze.py")],
                "Phase 4: LLM analysis of papers and trials",
                db_path=DATA_DB, run_id=run_id, phases=phases,
            )
        else:
            print("\n  Skipping LLM analysis (no GOOGLE_API_KEY, GROQ_API_KEY, or CEREBRAS_API_KEY set)")
            phases.append("Phase 4: Skipped (no API key)")

        # Phase 5: Build subcategories
        run(
            [sys.executable, os.path.join(SCRIPT_DIR, "analyze-research.py"),
             "--db", DATA_DB, "--only-subcategories"],
            "Phase 5: Build subcategories from AI analyses",
            db_path=DATA_DB, run_id=run_id, phases=phases,
        )

        # Phase 6: Rebuild forum/community tables in data.db
        run(
            [sys.executable, os.path.join(SCRIPT_DIR, "build-analysis-db.py")],
            "Phase 6: Rebuild forum/community tables from JSON",
            db_path=DATA_DB, run_id=run_id, phases=phases,
        )

        # Gather final stats
        db = sqlite3.connect(DATA_DB)
        papers = db.execute("SELECT COUNT(*) FROM pa_papers").fetchone()[0]
        trials = db.execute("SELECT COUNT(*) FROM tr_trials").fetchone()[0]
        forum_posts = 0
        try:
            row = db.execute("SELECT value FROM cb_forum_stats WHERE key = 'total_posts_cleaned'").fetchone()
            forum_posts = json.loads(row[0]) if row else 0
        except Exception:
            pass
        tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        db.close()

        elapsed = time.time() - start
        update_run(DATA_DB, run_id,
                   status="success",
                   finished_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                   phases_completed=json.dumps(phases),
                   papers_analyzed=papers,
                   trials_analyzed=trials,
                   forum_posts_analyzed=forum_posts)

        print(f"\n{'='*60}")
        print(f"  UPDATE COMPLETE in {elapsed:.0f}s")
        print(f"  Papers: {papers} | Trials: {trials} | Tables: {len(tables)}")
        print(f"  Output: {DATA_DB} ({os.path.getsize(DATA_DB)/1024:.0f} KB)")
        print(f"{'='*60}\n")

    except SystemExit:
        raise
    except Exception as e:
        update_run(DATA_DB, run_id,
                   status="failure",
                   error_message=str(e),
                   finished_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                   phases_completed=json.dumps(phases))
        raise


if __name__ == "__main__":
    main()

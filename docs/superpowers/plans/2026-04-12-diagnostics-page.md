# Diagnostics Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hidden `/diagnostics` page showing pipeline run history, analysis coverage, error logs, and data freshness — plus update the pipeline to capture run metadata and logs.

**Architecture:** Pipeline (`update-all.py`) writes run metadata + captured stdout/stderr to `rs_pipeline_runs` table in `data.db`. Frontend reads via new `useDataDb` queries and renders a diagnostics page using existing shadcn components.

**Tech Stack:** Python 3 (pipeline), SQLite, React 19, TypeScript, shadcn/ui (Card, Badge, Table)

**Spec:** `docs/superpowers/specs/2026-04-12-diagnostics-page-design.md`

---

### Task 1: Add pipeline run logging to update-all.py

**Files:**
- Modify: `scripts/update-all.py`

- [ ] **Step 1: Add run tracking functions and update the `run` helper**

Replace the entire `scripts/update-all.py` with this updated version that captures logs and writes run metadata:

```python
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
import uuid

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DB = os.path.join(PROJECT_ROOT, "public", "data.db")
ANALYSIS_DB = os.path.join(PROJECT_ROOT, "data", "analysis.db")


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

    # Print output to stdout as before
    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)

    # Log to DB
    if db_path and run_id:
        log_entry = f"\n{'='*60}\n  {description}\n{'='*60}\n"
        if result.stdout:
            log_entry += result.stdout
        if result.stderr:
            log_entry += f"\n[STDERR]\n{result.stderr}"
        append_log(db_path, run_id, log_entry)

        if phases is not None and result.returncode == 0:
            phases.append(description)
            import json
            update_run(db_path, run_id, phases_completed=json.dumps(phases))

    if result.returncode != 0:
        error_msg = f"FAILED: {description}"
        print(f"\n  {error_msg}")
        if db_path and run_id:
            import json
            update_run(db_path, run_id,
                       status="failure",
                       error_message=f"{error_msg}\n{result.stderr[-500:] if result.stderr else ''}",
                       finished_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                       phases_completed=json.dumps(phases or []))
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
    import json

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
        api_key = os.environ.get("CEREBRAS_API_KEY")
        if api_key:
            run(
                [sys.executable, os.path.join(SCRIPT_DIR, "llm-analyze.py")],
                "Phase 4: LLM analysis of papers and trials (Cerebras/Qwen3)",
                db_path=DATA_DB, run_id=run_id, phases=phases,
            )
        else:
            print("\n  Skipping LLM analysis (no CEREBRAS_API_KEY set)")
            phases.append("Phase 4: Skipped (no API key)")

        # Phase 5: Build subcategories
        run(
            [sys.executable, os.path.join(SCRIPT_DIR, "analyze-research.py"),
             "--db", DATA_DB, "--only-subcategories"],
            "Phase 5: Build subcategories from AI analyses",
            db_path=DATA_DB, run_id=run_id, phases=phases,
        )

        # Phase 6: Rebuild analysis.db
        run(
            [sys.executable, os.path.join(SCRIPT_DIR, "build-analysis-db.py")],
            "Phase 6: Rebuild analysis.db from JSON",
            db_path=DATA_DB, run_id=run_id, phases=phases,
        )

        # Phase 7: Merge analysis tables into data.db
        merge_analysis_into_data()
        phases.append("Phase 7: Merge analysis.db → data.db")

        # Gather final stats
        db = sqlite3.connect(DATA_DB)
        papers = db.execute("SELECT COUNT(*) FROM pa_papers").fetchone()[0]
        trials = db.execute("SELECT COUNT(*) FROM tr_trials").fetchone()[0]
        forum_posts = 0
        try:
            forum_posts = db.execute("SELECT value FROM cb_forum_stats WHERE key = 'total_posts_cleaned'").fetchone()
            forum_posts = json.loads(forum_posts[0]) if forum_posts else 0
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
        # run() calls sys.exit(1) on failure — already logged
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
```

- [ ] **Step 2: Verify syntax**

```bash
python -c "import py_compile; py_compile.compile('scripts/update-all.py', doraise=True)"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/update-all.py
git commit -m "feat: add pipeline run logging with output capture to rs_pipeline_runs"
```

---

### Task 2: Add diagnostics queries to data-db.tsx

**Files:**
- Modify: `src/lib/data-db.tsx`

- [ ] **Step 1: Add TypeScript types**

After the `Subcategory` interface, add:

```typescript
export interface PipelineRun {
  runId: string
  startedAt: string
  finishedAt: string | null
  status: "running" | "success" | "failure"
  errorMessage: string | null
  phasesCompleted: string[]
  papersAnalyzed: number
  trialsAnalyzed: number
  forumPostsAnalyzed: number
  trigger: string
  log: string
}

export interface AnalysisCoverage {
  totalPapers: number
  aiAnalyzed: number
  regexOnly: number
  errorCount: number
  totalTrials: number
  aiTrials: number
}

export interface AnalysisError {
  id: string
  error: string
  timestamp: string
  retryCount: number
}

export interface DataFreshness {
  newestPaperDate: string | null
  newestTrialDate: string | null
  lastRunAt: string | null
}
```

- [ ] **Step 2: Add query functions to the context interface**

In `DataDbContextValue`, add:

```typescript
  // Diagnostics
  getPipelineRuns: () => PipelineRun[]
  getAnalysisCoverage: () => AnalysisCoverage
  getAnalysisErrors: () => AnalysisError[]
  getDataFreshness: () => DataFreshness
```

- [ ] **Step 3: Implement getPipelineRuns**

After the `getSubcategories` callback, add:

```typescript
  const getPipelineRuns = useCallback((): PipelineRun[] => {
    if (!db) return []
    try {
      const rows = db.exec(
        "SELECT run_id, started_at, finished_at, status, error_message, phases_completed, papers_analyzed, trials_analyzed, forum_posts_analyzed, trigger, log FROM rs_pipeline_runs ORDER BY started_at DESC"
      )
      if (rows.length === 0) return []
      return rows[0].values.map((r) => ({
        runId: r[0] as string,
        startedAt: r[1] as string,
        finishedAt: r[2] as string | null,
        status: r[3] as "running" | "success" | "failure",
        errorMessage: r[4] as string | null,
        phasesCompleted: parseJsonSafe(r[5] as string, []),
        papersAnalyzed: (r[6] as number) || 0,
        trialsAnalyzed: (r[7] as number) || 0,
        forumPostsAnalyzed: (r[8] as number) || 0,
        trigger: r[9] as string,
        log: r[10] as string,
      }))
    } catch {
      return []
    }
  }, [db])
```

- [ ] **Step 4: Implement getAnalysisCoverage**

```typescript
  const getAnalysisCoverage = useCallback((): AnalysisCoverage => {
    if (!db) return { totalPapers: 0, aiAnalyzed: 0, regexOnly: 0, errorCount: 0, totalTrials: 0, aiTrials: 0 }
    try {
      const totalPapers = db.exec("SELECT COUNT(*) FROM pa_papers")[0]?.values[0][0] as number || 0
      const totalTrials = db.exec("SELECT COUNT(*) FROM tr_trials")[0]?.values[0][0] as number || 0

      let aiAnalyzed = 0
      let regexOnly = 0
      let aiTrials = 0
      try {
        aiAnalyzed = db.exec("SELECT COUNT(*) FROM pa_analyses WHERE analysis_source = 'ai'")[0]?.values[0][0] as number || 0
        regexOnly = db.exec("SELECT COUNT(*) FROM pa_analyses WHERE analysis_source = 'regex'")[0]?.values[0][0] as number || 0
        aiTrials = db.exec("SELECT COUNT(*) FROM tr_analyses")[0]?.values[0][0] as number || 0
      } catch { /* tables might not exist */ }

      let errorCount = 0
      try {
        errorCount = db.exec("SELECT COUNT(*) FROM rs_analysis_errors")[0]?.values[0][0] as number || 0
      } catch { /* table might not exist */ }

      return { totalPapers, aiAnalyzed, regexOnly, errorCount, totalTrials, aiTrials }
    } catch {
      return { totalPapers: 0, aiAnalyzed: 0, regexOnly: 0, errorCount: 0, totalTrials: 0, aiTrials: 0 }
    }
  }, [db])
```

- [ ] **Step 5: Implement getAnalysisErrors**

```typescript
  const getAnalysisErrors = useCallback((): AnalysisError[] => {
    if (!db) return []
    try {
      const rows = db.exec("SELECT id, error, timestamp, retry_count FROM rs_analysis_errors ORDER BY timestamp DESC")
      if (rows.length === 0) return []
      return rows[0].values.map((r) => ({
        id: r[0] as string,
        error: r[1] as string,
        timestamp: r[2] as string,
        retryCount: r[3] as number,
      }))
    } catch {
      return []
    }
  }, [db])
```

- [ ] **Step 6: Implement getDataFreshness**

```typescript
  const getDataFreshness = useCallback((): DataFreshness => {
    if (!db) return { newestPaperDate: null, newestTrialDate: null, lastRunAt: null }
    try {
      const newestPaper = db.exec("SELECT MAX(pub_date) FROM pa_papers")[0]?.values[0][0] as string | null
      const newestTrial = db.exec("SELECT MAX(start_date) FROM tr_trials")[0]?.values[0][0] as string | null
      let lastRun: string | null = null
      try {
        lastRun = db.exec("SELECT MAX(started_at) FROM rs_pipeline_runs")[0]?.values[0][0] as string | null
      } catch { /* table might not exist */ }
      return { newestPaperDate: newestPaper, newestTrialDate: newestTrial, lastRunAt: lastRun }
    } catch {
      return { newestPaperDate: null, newestTrialDate: null, lastRunAt: null }
    }
  }, [db])
```

- [ ] **Step 7: Add all four to the context value object**

```typescript
  const value: DataDbContextValue = {
    // ... existing fields ...
    getPipelineRuns,
    getAnalysisCoverage,
    getAnalysisErrors,
    getDataFreshness,
  }
```

- [ ] **Step 8: Verify types**

```bash
npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/data-db.tsx
git commit -m "feat: add diagnostics query functions to DataDbProvider"
```

---

### Task 3: Create the diagnostics page

**Files:**
- Create: `src/pages/diagnostics.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the diagnostics page component**

Create `src/pages/diagnostics.tsx`:

```typescript
import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  FlaskConical,
  Loader2,
  MessageCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { useDataDb, type PipelineRun } from "@/lib/data-db"

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "destructive" | "secondary" | "warning"; icon: typeof CheckCircle2 }> = {
  success: { label: "Success", variant: "success", icon: CheckCircle2 },
  failure: { label: "Failed", variant: "destructive", icon: XCircle },
  running: { label: "Running", variant: "secondary", icon: Loader2 },
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "—"
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`
  return `${(ms / 3600000).toFixed(1)}h`
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  const hours = ms / 3600000
  if (hours < 1) return `${Math.round(ms / 60000)}m ago`
  if (hours < 24) return `${Math.round(hours)}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function isCrashed(run: PipelineRun): boolean {
  return run.status === "running" && (Date.now() - new Date(run.startedAt).getTime()) > 3600000
}

export function DiagnosticsPage() {
  const { getPipelineRuns, getAnalysisCoverage, getAnalysisErrors, getDataFreshness } = useDataDb()
  const [expandedRun, setExpandedRun] = useState<string | null>(null)

  const runs = useMemo(() => getPipelineRuns(), [getPipelineRuns])
  const coverage = useMemo(() => getAnalysisCoverage(), [getAnalysisCoverage])
  const errors = useMemo(() => getAnalysisErrors(), [getAnalysisErrors])
  const freshness = useMemo(() => getDataFreshness(), [getDataFreshness])

  const lastRun = runs[0] ?? null
  const aiCoveragePct = coverage.totalPapers > 0
    ? Math.round((coverage.aiAnalyzed / coverage.totalPapers) * 100)
    : 0

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold">Diagnostics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pipeline status, analysis coverage, and error tracking
        </p>
      </div>

      {/* Last Run Status */}
      {lastRun && (
        <Card className={lastRun.status === "failure" || isCrashed(lastRun) ? "border-destructive/50" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="size-4" />
              Last Pipeline Run
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {isCrashed(lastRun) ? (
                <Badge variant="warning">Crashed</Badge>
              ) : (
                <Badge variant={STATUS_BADGE[lastRun.status]?.variant ?? "secondary"}>
                  {STATUS_BADGE[lastRun.status]?.label ?? lastRun.status}
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">{timeAgo(lastRun.startedAt)}</span>
              <span className="text-sm text-muted-foreground">
                Duration: {formatDuration(lastRun.startedAt, lastRun.finishedAt)}
              </span>
              <Badge variant="outline" className="text-xs">{lastRun.trigger}</Badge>
            </div>
            {lastRun.errorMessage && (
              <pre className="rounded-md bg-destructive/10 p-3 text-xs text-destructive overflow-x-auto">
                {lastRun.errorMessage}
              </pre>
            )}
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Papers: {lastRun.papersAnalyzed}</span>
              <span>Trials: {lastRun.trialsAnalyzed}</span>
              {lastRun.forumPostsAnalyzed > 0 && <span>Forum posts: {lastRun.forumPostsAnalyzed}</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<FileText className="size-4" />} value={coverage.totalPapers} label="Total Papers" />
        <StatCard icon={<Database className="size-4" />} value={`${aiCoveragePct}%`} label="AI Analyzed" />
        <StatCard icon={<FlaskConical className="size-4" />} value={coverage.totalTrials} label="Total Trials" />
        <StatCard icon={<AlertTriangle className="size-4" />} value={coverage.errorCount} label="Errors" />
      </div>

      {/* Analysis Coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Analysis Coverage</CardTitle>
          <CardDescription className="text-xs">
            Papers analyzed by AI vs regex-only classification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="w-20 text-xs font-medium">AI</span>
              <div className="flex-1 rounded-full bg-muted h-3 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${aiCoveragePct}%` }} />
              </div>
              <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{coverage.aiAnalyzed}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-20 text-xs font-medium">Regex</span>
              <div className="flex-1 rounded-full bg-muted h-3 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${coverage.totalPapers > 0 ? Math.round((coverage.regexOnly / coverage.totalPapers) * 100) : 0}%` }} />
              </div>
              <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{coverage.regexOnly}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-20 text-xs font-medium">Trials (AI)</span>
              <div className="flex-1 rounded-full bg-muted h-3 overflow-hidden">
                <div className="h-full rounded-full bg-purple-500" style={{ width: `${coverage.totalTrials > 0 ? Math.round((coverage.aiTrials / coverage.totalTrials) * 100) : 0}%` }} />
              </div>
              <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{coverage.aiTrials} / {coverage.totalTrials}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Freshness */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="size-4" />
            Data Freshness
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Newest Paper</p>
              <p className="font-medium">{freshness.newestPaperDate ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Newest Trial</p>
              <p className="font-medium">{freshness.newestTrialDate ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Last Pipeline Run</p>
              <p className="font-medium">{freshness.lastRunAt ? timeAgo(freshness.lastRunAt) : "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Run History */}
      {runs.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">Run History</h3>
          <div className="flex flex-col gap-2">
            {runs.map((r) => {
              const crashed = isCrashed(r)
              const expanded = expandedRun === r.runId
              return (
                <Card key={r.runId} className="hover:shadow-sm transition-all">
                  <CardContent className="py-3">
                    <button
                      className="flex w-full items-center gap-3 text-left"
                      onClick={() => setExpandedRun(expanded ? null : r.runId)}
                    >
                      {expanded ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
                      {crashed ? (
                        <Badge variant="warning" className="text-[0.6rem]">Crashed</Badge>
                      ) : (
                        <Badge variant={STATUS_BADGE[r.status]?.variant ?? "secondary"} className="text-[0.6rem]">
                          {STATUS_BADGE[r.status]?.label ?? r.status}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{new Date(r.startedAt).toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">{formatDuration(r.startedAt, r.finishedAt)}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {r.papersAnalyzed}p / {r.trialsAnalyzed}t
                        {r.forumPostsAnalyzed > 0 && ` / ${r.forumPostsAnalyzed}f`}
                      </span>
                      <Badge variant="outline" className="ml-auto text-[0.6rem]">{r.trigger}</Badge>
                    </button>
                    {expanded && (
                      <div className="mt-3 flex flex-col gap-2">
                        {r.phasesCompleted.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {r.phasesCompleted.map((p, i) => (
                              <Badge key={i} variant="secondary" className="text-[0.6rem]">{p}</Badge>
                            ))}
                          </div>
                        )}
                        {r.errorMessage && (
                          <pre className="rounded-md bg-destructive/10 p-2 text-[0.65rem] text-destructive overflow-x-auto">
                            {r.errorMessage}
                          </pre>
                        )}
                        {r.log && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                              Full log output
                            </summary>
                            <pre className="mt-2 max-h-[400px] overflow-auto rounded-md bg-muted p-3 text-[0.65rem]">
                              {r.log}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Error Log */}
      {errors.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              Analysis Errors
              <Badge variant="destructive" className="text-xs">{errors.length}</Badge>
            </h3>
            <div className="flex flex-col gap-2">
              {errors.map((e) => (
                <Card key={e.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <a
                          href={`https://pubmed.ncbi.nlm.nih.gov/${e.id}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          PMID {e.id}
                        </a>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{e.error}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[0.65rem] text-muted-foreground">{timeAgo(e.timestamp)}</span>
                        <Badge variant="outline" className="text-[0.6rem]">Retry #{e.retryCount}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Subcategory Summary */}
      <Separator />
      <SubcategorySummary />
    </div>
  )
}

function SubcategorySummary() {
  const { getCategories, getSubcategories } = useDataDb()
  const categories = useMemo(() => getCategories(), [getCategories])

  const summary = useMemo(() => {
    let total = 0
    const perCat = categories.map((cat) => {
      const subs = getSubcategories(cat)
      total += subs.length
      return { category: cat, count: subs.length }
    }).filter((c) => c.count > 0)
    return { perCat, total }
  }, [categories, getSubcategories])

  if (summary.total === 0) return null

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">
        Subcategories
        <span className="ml-2 text-sm font-normal text-muted-foreground">({summary.total} terms)</span>
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {summary.perCat.map(({ category, count }) => (
          <Card key={category}>
            <CardContent className="flex flex-col items-center gap-1 py-3">
              <span className="text-lg font-bold tabular-nums text-primary">{count}</span>
              <span className="text-[0.65rem] font-medium text-muted-foreground">{category}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-[0.65rem] font-medium uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-xl font-bold tabular-nums tracking-tight">{value}</span>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Add route to App.tsx**

In `src/App.tsx`, add the import and route:

Add import at top:
```typescript
import { DiagnosticsPage } from "@/pages/diagnostics"
```

Add route after the community route (line 58):
```tsx
              <Route path="/diagnostics" element={<DiagnosticsPage />} />
```

- [ ] **Step 3: Verify types and test**

```bash
npx tsc --noEmit
```

Then open `http://localhost:5175/cluster-headache-hub/diagnostics` and verify the page renders (will show empty/default state until a pipeline run populates the data).

- [ ] **Step 4: Commit**

```bash
git add src/pages/diagnostics.tsx src/App.tsx src/lib/data-db.tsx
git commit -m "feat: add hidden /diagnostics page with pipeline status, coverage, and errors"
```

# Diagnostics Page

## Problem

Pipeline failures (schema mismatches, rate limiting, API errors) are only visible in GitHub Actions logs. No way to see analysis coverage, errors, or data freshness from the app itself.

## Solution

A hidden diagnostics page at `/diagnostics` (no nav link) that shows pipeline run history, analysis coverage, errors, and data freshness. Pipeline metadata stored in DB so crashes and failures are visible.

## New DB Table: rs_pipeline_runs

| Column | Type | Description |
|--------|------|-------------|
| run_id | TEXT | UUID or timestamp-based ID |
| started_at | TEXT | ISO timestamp |
| finished_at | TEXT | ISO timestamp (null if running/crashed) |
| status | TEXT | running, success, failure |
| error_message | TEXT | Error details if failed |
| phases_completed | TEXT | JSON array of completed phase names |
| papers_analyzed | INTEGER | Papers processed in this run |
| trials_analyzed | INTEGER | Trials processed in this run |
| forum_posts_analyzed | INTEGER | Forum posts processed (0 if skipped) |
| trigger | TEXT | schedule, workflow_dispatch, manual |
| log | TEXT | Full pipeline output log (stdout + stderr) |

## Pipeline Changes (update-all.py)

1. At pipeline start: insert row with status=running
2. After each phase: update phases_completed
3. Capture all stdout/stderr from each phase subprocess and append to log column
4. On success: update status=success, finished_at, paper/trial/forum counts
5. On failure: wrap main() in try/except, update status=failure with error_message + log
6. If pipeline crashes without catching: the row stays as status=running with no finished_at — the diagnostics page shows this as "crashed" (started but never finished)
7. Forum analysis: if --forum-db provided, track forum_posts_analyzed count

## Page Sections

### 1. Last Run Status
- Large status badge: success (green), failure (red), running (blue), crashed (amber)
- Timestamp, duration
- Error message if failed (collapsible)
- "Crashed" detected by: status=running AND started_at > 1 hour ago

### 2. Run History
- All runs in a compact table
- Columns: date, status badge, duration, papers analyzed, trials analyzed, forum posts, trigger
- Most recent first
- Expandable row to show full log output

### 3. Analysis Coverage
- Total papers, papers with AI analysis, papers with regex-only, papers with errors
- Visual progress bar showing AI coverage percentage
- Total trials, trials with AI analysis

### 4. Error Log
- Table from rs_analysis_errors
- Columns: PMID (linked to PubMed), error message (truncated), timestamp, retry count
- Sorted by most recent
- Count badge in section header

### 5. Subcategory Summary
- Terms per category in a compact grid
- Total terms across all categories

### 6. Data Freshness
- Newest paper publication date
- Newest trial start date
- Last pipeline run timestamp
- Age indicator (e.g., "3 days ago")

## Frontend

- Route: `/diagnostics` in App.tsx, no Suspense/lazy needed (small page)
- Page component: `src/pages/diagnostics.tsx`
- Uses `useDataDb` for all queries — add new query functions for pipeline runs and coverage stats
- No nav link — accessible only by direct URL
- Uses existing shadcn components: Card, Badge, Table

## Data Layer (data-db.tsx)

New query functions:
- `getPipelineRuns()` — all runs ordered by started_at DESC
- `getAnalysisCoverage()` — counts: total papers, AI analyzed, regex only, errors
- `getAnalysisErrors()` — all rows from rs_analysis_errors
- `getDataFreshness()` — newest paper date, newest trial date

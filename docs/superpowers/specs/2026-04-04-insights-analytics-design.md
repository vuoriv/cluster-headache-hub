# ClusterBusters Insights Analytics

**Date:** 2026-04-04
**Status:** Approved (working independently)

## Summary

Add 6 insight sub-pages under `/clusterbusters/insights/*`, each presenting a different analytical lens on the 40K forum posts. Data extracted by a new Python pipeline stage, stored in analysis.db, displayed with recharts + shadcn cards.

## Pages

### 1. Patient Journeys (`/clusterbusters/insights/patient-journeys`)
Track 691 returning users across multiple years — cycle recurrence patterns, treatment progression, remission/return signals.

### 2. Episodic vs Chronic (`/clusterbusters/insights/episodic-vs-chronic`)
Cross-reference CH type mentions with treatment outcomes. 1,244 episodic + 2,226 chronic posts with treatment data.

### 3. Treatment Paths (`/clusterbusters/insights/treatment-paths`)
From repeat posters: what patients try first → what they switch to. Doctor-prescribed → community-discovered progression.

### 4. Community Demographics (`/clusterbusters/insights/demographics`)
2,754 unique authors, posting patterns, community growth, new vs veteran activity.

### 5. Cycle Patterns (`/clusterbusters/insights/cycle-patterns`)
Seasonal posting spikes, time-of-day patterns, year-over-year treatment trend shifts.

### 6. Gender & Caregivers (`/clusterbusters/insights/gender-caregivers`)
1,523 caregiver posts, estimated patient gender from relationship mentions, caregiver concerns vs patient concerns.

## Pipeline

New Python script: `scripts/analyze-insights.py`
- Reads from `clusterbusters.db`
- Outputs to `src/data/insights/*.json`
- Integrated into `build-analysis-db.py` → stored in `insights_*` tables in analysis.db

## Frontend

- New route: `/clusterbusters/insights/:slug`
- Navigation from ClusterBusters landing page
- Each page: hero stat cards + charts + narrative text

# Deep Research Analysis Pipeline

**Date:** 2026-04-05
**Status:** Approved (working independently)

## Summary

1. Convert all TypeScript pipeline scripts to Python (consistency with existing analysis scripts)
2. Expand PubMed search to capture 4,400+ papers (was missing ~800)
3. Add deep paper/trial analysis using Claude subagents
4. Build research insights frontend pages

## Phase 1: Pipeline Migration (TS → Python)

Replace `scripts/pipeline/*.ts` with a single `scripts/fetch-research.py`:
- Fetch from PubMed (expanded query: MeSH + Title/Abstract + TAC)
- Fetch from ClinicalTrials.gov
- Enrich with categories + relevance scores
- Build research tables in data.db directly (no intermediate research.db)

Remove: `scripts/pipeline/` directory, `better-sqlite3` + `tsx` dev dependencies

## Phase 2: Deep Analysis

New script: `scripts/analyze-research.py`
- Process all papers with abstracts using Claude subagents (batches of 50)
- Extract per paper: study_type, result, key_finding, sample_size, novelty
- Process all trials: extract status, phase, result summary
- Store in `paper_analyses` table in data.db

Extracted fields per paper:
```
study_type: RCT | observational | review | meta-analysis | case-report | protocol | editorial
result: positive | negative | mixed | inconclusive | ongoing | not-applicable
treatment_focus: mapped to treatment categories
key_finding: 1-2 sentence plain-English summary
sample_size: number or null
novelty: breakthrough | confirmation | incremental | historical | review
```

## Phase 3: Research Insights Frontend

New pages under `/research/insights/`:
1. **Research Landscape** — study types, categories, volume over time
2. **Evidence Dashboard** — success/failure rates by treatment, evidence quality
3. **Key Findings** — major results timeline, breakthroughs highlighted
4. **Treatment Evidence** — per-treatment evidence summary (RCTs vs case reports)

## Search Query Fix

Old: `cluster headache[Title/Abstract]` → 3,595 papers
New: `"cluster headache"[MeSH] OR "cluster headache"[Title/Abstract] OR "trigeminal autonomic cephalalgia"[Title/Abstract]` → 4,403 papers

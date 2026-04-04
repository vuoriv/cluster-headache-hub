# Refactor: 6 Tabs → 3 Sections

**Date:** 2026-04-04
**Status:** Approved (per user spec)

## Summary

Replace the current 6-tab UI with 3 sections powered by a preprocessed local research database:

1. **ClusterBusters** — existing forum analysis (unchanged, code-split with React.lazy)
2. **Research Search** — search/explore PubMed papers + trial data from local DB
3. **Active Trials** — currently active clinical trials from local DB

## Architecture

### Data Pipeline (build-time)

```
ClinicalTrials.gov API ──┐
                         ├──→ scripts/pipeline/ ──→ public/research.db
PubMed eUtils API ───────┘
```

- **Node.js script** runs at build time (or manually via `npm run pipeline`)
- Fetches from both APIs, enriches with categories + relevance scores
- Outputs `public/research.db` (SQLite, read by sql.js at runtime)
- Weekly scheduled updates deferred to later

### Database Schema (research.db)

```sql
CREATE TABLE trials (
  nct_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  phase TEXT,            -- JSON array
  study_type TEXT,
  sponsor TEXT,
  enrollment INTEGER,
  start_date TEXT,
  end_date TEXT,
  interventions TEXT,    -- JSON array
  summary TEXT,
  conditions TEXT,
  category TEXT,         -- enriched: psychedelic, cgrp, oxygen, etc.
  relevance_score REAL,
  last_updated TEXT,
  raw_json TEXT
);

CREATE TABLE papers (
  pmid TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT,
  journal TEXT,
  pub_date TEXT,
  abstract TEXT,
  mesh_terms TEXT,       -- JSON array
  category TEXT,         -- enriched
  relevance_score REAL,
  last_updated TEXT
);

CREATE TABLE pipeline_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### Enrichment

Category assignment reuses existing `categoryForTrial()` logic, extended to papers:
- `psychedelic` — psilocybin, LSD, ketamine, busting
- `cgrp` — galcanezumab, erenumab, gepants
- `oxygen` — O2 therapy
- `pharmacology` — verapamil, lithium, melatonin
- `nerve-block` — SPG, occipital, botulinum
- `neuromodulation` — VNS, stimulation
- `vitamin-d` — vitamin D3, cholecalciferol
- `other`

Relevance scoring: higher scores for patient-community validated treatments (psychedelic, oxygen, vitamin-d).

### Frontend

**Routing:** react-router-dom with `basename="/cluster-headache-hub/"`

| Route | Component | Loading |
|-------|-----------|---------|
| `/` | Redirect → `/clusterbusters` | — |
| `/clusterbusters/*` | ClusterBusters (existing) | React.lazy |
| `/research` | ResearchSearch | Eager |
| `/trials` | ActiveTrials | Eager |

**Navigation:** Top nav bar replaces tab strip. Three items: ClusterBusters, Research, Trials.

**Code-splitting:** ClusterBusters (largest section with sql.js + recharts) wrapped in React.lazy + Suspense.

### Files to Delete

- `src/components/tabs/overview-tab.tsx`
- `src/components/tabs/trials-tab.tsx`
- `src/components/tabs/research-tab.tsx`
- `src/components/tabs/treatments-tab.tsx`
- `src/components/tabs/community-tab.tsx`
- `src/components/tabs/triggers-tab.tsx`
- `src/hooks/use-trials.ts`
- `src/hooks/use-papers.ts`
- `src/lib/static-trials.ts`

### Files to Keep

- `src/components/tabs/clusterbusters-tab.tsx` + `clusterbusters/` directory
- `src/lib/analysis-db.tsx` + `src/lib/clusterbusters-types.ts`
- All `src/components/ui/` shadcn components
- All i18n files (community keys still used if merged)

## Questions for User

1. **Default route** — Should `/` go to ClusterBusters or a landing page?
2. **Community tab content** — Merge busting protocols + vitamin D info into ClusterBusters, or drop?
3. **Research Search UI** — Full-text search + category/year filters? Or simpler?
4. **PubMed abstracts** — Fetch full abstracts via efetch (slower pipeline, richer search)?
5. **Enrichment depth** — Is category + relevance score enough, or add patient-perspective tags?

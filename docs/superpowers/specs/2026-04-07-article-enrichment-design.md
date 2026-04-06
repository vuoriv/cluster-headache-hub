# Article Enrichment, AI Analysis & Trial Cross-Linking

**Date:** 2026-04-07
**Status:** Approved
**Scope:** Pipeline enrichment, DB schema overhaul, frontend migration from JSON to DB

---

## Overview

Enrich existing PubMed paper data with full text (when available), structured metadata, AI-generated analysis, open access status, and cross-link papers to clinical trials. Simultaneously migrate the entire frontend from dual JSON+DB reads to DB-only, with a clean prefixed table naming convention.

---

## 1. DB Schema — Prefixed Table Convention

**Rule: every table MUST have a domain prefix.**

| Prefix | Domain |
|--------|--------|
| `pa_` | Papers (PubMed publications) |
| `tr_` | Trials (ClinicalTrials.gov) |
| `cb_` | ClusterBusters forum |
| `rs_` | Research stats (cross-cutting) |
| `co_` | Community |

### Source Tables

#### `pa_papers`

Migrated from current `papers` table + new enrichment columns.

```sql
CREATE TABLE pa_papers (
  pmid TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT,
  journal TEXT,
  pub_date TEXT,
  abstract TEXT,
  abstract_structured TEXT,    -- NEW: JSON {background, methods, results, conclusion}
  mesh_terms TEXT,             -- JSON array (existing)
  author_keywords TEXT,        -- NEW: JSON array
  affiliations TEXT,           -- NEW: JSON array of institution strings
  doi TEXT,                    -- NEW
  pmcid TEXT,                  -- NEW: PubMed Central ID
  full_text_sections TEXT,     -- NEW: JSON {results, discussion, conclusion} from PMC/EuropePMC
  nct_ids_cited TEXT,          -- NEW: JSON array of NCT IDs found in text
  is_oa INTEGER,               -- NEW: boolean (0/1)
  oa_url TEXT,                 -- NEW: best open access URL
  oa_status TEXT,              -- NEW: gold/green/hybrid/closed
  category TEXT,
  relevance_score REAL,
  last_updated TEXT
);
CREATE INDEX idx_pa_papers_category ON pa_papers(category);
CREATE INDEX idx_pa_papers_pub_date ON pa_papers(pub_date);
CREATE INDEX idx_pa_papers_doi ON pa_papers(doi);
```

#### `tr_trials`

Migrated from current `trials` table. No new columns.

```sql
CREATE TABLE tr_trials (
  nct_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  phase TEXT,                  -- JSON array
  study_type TEXT,
  sponsor TEXT,
  enrollment INTEGER,
  start_date TEXT,
  end_date TEXT,
  interventions TEXT,          -- JSON array
  summary TEXT,
  conditions TEXT,
  category TEXT,
  relevance_score REAL,
  last_updated TEXT,
  raw_json TEXT
);
CREATE INDEX idx_tr_trials_category ON tr_trials(category);
CREATE INDEX idx_tr_trials_status ON tr_trials(status);
```

### Analysis Tables

#### `pa_analyses`

Replaces current regex-based `paper_analyses` table. AI-generated for papers with abstracts/full text, regex fallback for the rest.

```sql
CREATE TABLE pa_analyses (
  pmid TEXT PRIMARY KEY,
  outcome TEXT,                -- showed_benefit / no_benefit / mixed / inconclusive / basic_science
  plain_summary TEXT,          -- 2-3 sentence patient-friendly explanation
  key_finding TEXT,            -- single most important result
  sample_size INTEGER,
  study_type TEXT,             -- rct / observational / case_report / review / meta_analysis / basic_science / other
  evidence_tier INTEGER,       -- 1-5 (1=strongest)
  interventions_studied TEXT,  -- JSON array of treatment names
  analysis_source TEXT,        -- 'ai' or 'regex' (tracks which method was used)
  FOREIGN KEY (pmid) REFERENCES pa_papers(pmid)
);
```

#### `tr_analyses`

Migrated from `trial-analyses.json` to DB table.

```sql
CREATE TABLE tr_analyses (
  nct_id TEXT PRIMARY KEY,
  what_tested TEXT,
  key_result TEXT,
  verdict TEXT,                -- success / failure / mixed / ongoing / terminated / unknown
  patient_relevance TEXT,
  dose_tested TEXT,
  sample_size INTEGER,
  FOREIGN KEY (nct_id) REFERENCES tr_trials(nct_id)
);
```

### Cross-Linking Table

#### `rs_paper_trial_links`

```sql
CREATE TABLE rs_paper_trial_links (
  pmid TEXT NOT NULL,
  nct_id TEXT NOT NULL,
  link_type TEXT NOT NULL,     -- 'confirmed' (NCT ID in text) or 'related' (topic match)
  PRIMARY KEY (pmid, nct_id),
  FOREIGN KEY (pmid) REFERENCES pa_papers(pmid),
  FOREIGN KEY (nct_id) REFERENCES tr_trials(nct_id)
);
CREATE INDEX idx_rs_links_nct ON rs_paper_trial_links(nct_id);
CREATE INDEX idx_rs_links_pmid ON rs_paper_trial_links(pmid);
```

### Aggregation Tables

#### `rs_category_stats`

Pre-computed per-category stats combining papers + trials.

```sql
CREATE TABLE rs_category_stats (
  category TEXT PRIMARY KEY,
  paper_count INTEGER,
  trial_count INTEGER,
  active_trial_count INTEGER,
  positive_outcome_count INTEGER,
  avg_evidence_tier REAL,
  oa_rate REAL,
  papers_linked_to_trials INTEGER,
  top_authors TEXT,            -- JSON array [{name, count}]
  top_institutions TEXT,       -- JSON array [{name, count}]
  papers_per_year TEXT,        -- JSON {year: count}
  study_type_distribution TEXT,-- JSON [{type, count}]
  result_distribution TEXT     -- JSON [{result, count}]
);
```

#### `rs_stats`

Global research stats (replaces `pipeline_meta` + `paper-stats.json` + `trial-stats.json`).

```sql
CREATE TABLE rs_stats (
  key TEXT PRIMARY KEY,
  value TEXT                   -- JSON or scalar
);
```

Keys: `last_run`, `paper_count`, `trial_count`, `papers_with_abstracts`, `papers_with_full_text`, `oa_rate`, `top_authors`, `top_institutions`, `study_type_distribution`, `result_distribution`, `evidence_tier_distribution`, `papers_per_year`, `trial_status_distribution`, `trial_phase_distribution`, `trial_top_sponsors`, `trial_avg_enrollment_by_category`, `research_volume_by_category`.

### Forum Tables (renamed)

| Old name | New name |
|----------|----------|
| `forum_stats` | `cb_forum_stats` |
| `treatment_rankings` | `cb_treatment_rankings` |
| `treatment_profiles` | `cb_treatment_profiles` |
| `outcomes` | `cb_outcomes` |
| `timeline` | `cb_timeline` |
| `co_occurrence` | `cb_co_occurrence` |
| `insights` | `cb_insights` |
| `recommendation_data` | `cb_recommendation_data` |
| `community_groups` | `co_groups` |

---

## 2. Pipeline Changes

### `fetch-research.py` — Data Enrichment

**Phase A: Existing PubMed fetch** (unchanged logic, writes to `pa_papers`)

**Phase B: EFETCH enrichment** (new)

For papers where `doi IS NULL` (not yet enriched):
1. Batch 200 PMIDs per EFETCH request
2. Parse XML response, extract:
   - `abstract_structured`: JSON with {background, methods, results, conclusion} from `<AbstractText Label="...">` elements
   - `author_keywords`: from `<Keyword>` elements
   - `affiliations`: from `<AffiliationInfo>` elements
   - `doi`: from `<ArticleId IdType="doi">`
   - `pmcid`: from `<ArticleId IdType="pmc">`
   - `nct_ids_cited`: regex `NCT\d{8}` scan on full abstract text
3. Rate limit: 0.35s delay (3 req/sec), or 0.1s with `NCBI_API_KEY`

**Phase C: Full text retrieval** (new)

For papers where `pmcid IS NOT NULL AND full_text_sections IS NULL`:

Waterfall with early exit:
1. **PMC**: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id={PMCID}&retmode=xml`
   - Extract `<sec sec-type="results">`, `<sec sec-type="discussion">`, `<sec sec-type="conclusions">`
   - Store as JSON in `full_text_sections`
2. **Europe PMC**: `https://www.ebi.ac.uk/europepmc/webservices/rest/{PMCID}/fullTextXML`
   - Same extraction logic
3. **Unpaywall HTML**: If `oa_url` is HTML (not PDF), fetch and extract body text
   - Only for gold/green OA papers

For papers without PMCID, try Europe PMC by PMID:
`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:{PMID}&resultType=core&format=json`

**Phase D: Unpaywall OA status** (new)

For papers where `doi IS NOT NULL AND oa_status IS NULL`:
1. `https://api.unpaywall.org/v2/{DOI}?email=ville.vuori@willba.app`
2. Store: `is_oa`, `oa_url`, `oa_status`
3. Rate limit: 1 req/sec (Unpaywall limit)

### `llm-analyze.py` — AI Analysis

**Existing: Trial analysis** (unchanged logic, writes to `tr_analyses` instead of JSON)

**New: Paper analysis**

For papers where no `pa_analyses` row exists AND paper has abstract/full text:

Input priority (richest content):
1. `full_text_sections` (results + discussion + conclusion)
2. `abstract_structured` (sectioned abstract)
3. `abstract` (plain text)

Prompt:
```
You are analyzing a research paper about cluster headache. Based on the content below, provide a structured analysis written for patients, not doctors.

Title: {title}
Authors: {authors}
Journal: {journal} ({year})
Category: {category}
MeSH Terms: {mesh_terms}

Content:
{best available content}

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "outcome": "showed_benefit|no_benefit|mixed|inconclusive|basic_science",
  "plain_summary": "2-3 sentence explanation of what was studied and found, written for a CH patient with no medical background",
  "key_finding": "single sentence — the most important result with numbers if available",
  "sample_size": number or null,
  "study_type": "rct|observational|case_report|review|meta_analysis|basic_science|other",
  "evidence_tier": 1-5,
  "interventions_studied": ["treatment1", "treatment2"]
}
```

Evidence tier guide in prompt:
- 1 = meta-analysis / systematic review
- 2 = RCT
- 3 = observational / cohort
- 4 = case series
- 5 = case report / editorial / basic science

Papers without abstracts: keep existing regex-based classification, stored with `analysis_source = 'regex'`.

### `analyze-research.py` — Cross-Linking & Stats

**Build `rs_paper_trial_links`:**
1. **Confirmed links**: match `pa_papers.nct_ids_cited[]` entries against `tr_trials.nct_id`
2. **Related links**: match papers and trials sharing the same `category` AND overlapping `interventions_studied` (from `pa_analyses`) with trial `interventions` (from `tr_trials`)

**Build `rs_category_stats`**: aggregate from `pa_papers`, `pa_analyses`, `tr_trials`, `tr_analyses` per category.

**Build `rs_stats`**: compute global stats, store as key-value pairs.

### `build-analysis-db.py` — Table Renames

Rename all output tables to prefixed versions (`cb_`, etc.).

### `update-all.py` — Updated Orchestration

1. Phase 1: Fetch PubMed + ClinicalTrials.gov → `pa_papers`, `tr_trials`
2. Phase 1b: EFETCH enrichment → update `pa_papers`
3. Phase 1c: Full text retrieval (PMC → EuropePMC → Unpaywall HTML)
4. Phase 1d: Unpaywall OA status
5. Phase 2: Classify papers (regex fallback for papers without abstracts)
6. Phase 2b: Generate per-category deep dives → `rs_category_stats`
7. Phase 3: Forum analysis (optional) → `cb_*` tables
8. Phase 3b: Community insights
9. Phase 3.5: LLM analysis of trials + papers → `tr_analyses`, `pa_analyses`
10. Phase 4: Build cross-links → `rs_paper_trial_links`
11. Phase 5: Compute stats → `rs_stats`
12. Phase 6: Merge all into `data.db`

---

## 3. Frontend Changes

### Data Layer (`src/lib/data-db.tsx`)

**Updated queries** — all use new table names:
- `searchPapers()` → queries `pa_papers` + LEFT JOIN `pa_analyses`
- `searchTrials()` → queries `tr_trials`
- `getPaper(pmid)` → `pa_papers` + `pa_analyses`
- `getTrial(nctId)` → `tr_trials` + `tr_analyses`

**New queries:**
- `getPaperAnalysis(pmid)` → `pa_analyses`
- `getTrialAnalysis(nctId)` → `tr_analyses`
- `getLinkedPapers(nctId)` → papers citing this trial via `rs_paper_trial_links`
- `getLinkedTrials(pmid)` → trials cited by this paper via `rs_paper_trial_links`
- `getCategoryStats(category)` → `rs_category_stats`
- `getResearchStats()` → `rs_stats` (replaces JSON imports)
- `getTopAuthors(limit)` → computed from `pa_papers.affiliations`

**Removed:**
- All `import ... from "@/data/"` in research components
- `src/data/trials/trial-analyses.json` import
- `src/data/research-insights/paper-stats.json` import
- `src/data/research-insights/trial-stats.json` import
- `src/data/research-insights/categories/*.json` imports

### Paper Cards (`research-search.tsx`)

Current: title, authors, journal, abstract snippet, category badge.

New fields displayed:
- `plain_summary` — AI-generated patient-friendly summary (replaces raw abstract in collapsed view)
- `key_finding` — highlighted key result
- Outcome badge: Showed Benefit (success) / No Benefit (destructive) / Mixed (warning) / Inconclusive (secondary) / Basic Science (outline)
- Evidence tier badge (Tier 1-5)
- OA badge + link (if `is_oa` = true, link to `oa_url`)
- Linked trials section: "Cites trial NCT..." with link to trial detail

### Trial Detail (`active-trials.tsx`)

Current: loads analysis from JSON import `trial-analyses.json`.

Changes:
- Load from `tr_analyses` DB table instead
- New section: "Papers citing this trial" — list of papers from `rs_paper_trial_links` where `link_type = 'confirmed'`
- New section: "Related papers" — papers with `link_type = 'related'`

### Category Pages (`research/category.tsx`)

Current: loads from `src/data/research-insights/categories/*.json` static imports.

Changes:
- Load from `rs_category_stats` DB table
- New stats: OA rate, papers linked to trials count
- Top authors list
- Top institutions list

### Evidence Dashboard (`research/evidence.tsx`)

Current: imports `paper-stats.json` and `trial-stats.json`.

Changes:
- All stats computed from `rs_stats` DB queries
- New charts: top authors by publication count, top institutions, OA rate trend over time

### Research Landscape (`research/landscape.tsx`)

Current: imports `paper-stats.json`.

Changes:
- All stats from `rs_stats` DB queries
- New: top authors, top institutions, OA rate

---

## 4. File Cleanup

**Delete after migration:**
- `src/data/trials/trial-analyses.json`
- `src/data/trials/all-trials.json`
- `src/data/research-insights/paper-stats.json`
- `src/data/research-insights/trial-stats.json`
- `src/data/research-insights/categories/*.json`

**Keep** (forum/community data still loaded from JSON into DB via build-analysis-db.py):
- `src/data/treatments/*.json`
- `src/data/posts/*.json`
- `src/data/insights/*.json`
- `src/data/outcomes.json`
- `src/data/community-groups.json`
- Other ClusterBusters data files

These are pipeline intermediates consumed by `build-analysis-db.py` → written to `cb_*` / `co_*` tables.

---

## 5. Verification

**Cross-link verification:**
PMID 38581739 (Schindler 2024) should contain "NCT02981173" in its abstract → produces a confirmed link in `rs_paper_trial_links`.

**AI analysis verification:**
A paper about psilocybin RCT should get: `outcome: "showed_benefit"`, `study_type: "rct"`, `evidence_tier: 2`, `interventions_studied: ["psilocybin"]`.

---

## 6. API Rate Limits

| API | Limit | Strategy |
|-----|-------|----------|
| PubMed EFETCH | 3 req/sec (10 with API key) | 200 IDs/batch, 0.35s delay |
| PMC EFETCH | 3 req/sec | Same as PubMed |
| Europe PMC | 10 req/sec | 0.1s delay |
| Unpaywall | 1 req/sec | 1s delay per DOI |
| Cerebras LLM | ~1 req/sec | 1s delay (existing) |

All calls happen during weekly refresh only. Zero external API calls at frontend runtime.

---

## 7. Open Questions (post-implementation)

- Should forum treatment data (cb_* tables) also eventually move to DB-only (eliminating JSON intermediates)?
- Should we add Semantic Scholar TLDR as an additional fallback for papers without abstracts?
- Should paper search support filtering by OA status, evidence tier, or outcome?

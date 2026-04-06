# Article Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich PubMed papers with full text, AI analysis, OA status, and trial cross-links; migrate entire data layer from JSON+DB to DB-only with clean prefixed table naming.

**Architecture:** Python pipeline fetches/enriches data into SQLite with prefixed tables (`pa_`, `tr_`, `cb_`, `rs_`, `co_`). Frontend reads everything from the DB via sql.js — no JSON imports. AI analysis uses Cerebras/Qwen3 for both trials and papers.

**Tech Stack:** Python 3.11, SQLite, requests, xml.etree.ElementTree, React 19, TypeScript, sql.js, Vite, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-07-article-enrichment-design.md`

---

## Phase 1: DB Schema Migration (Pipeline)

### Task 1: Rename tables in `fetch-research.py`

**Files:**
- Modify: `scripts/fetch-research.py`

- [ ] **Step 1: Update papers table CREATE SQL**

Change the table creation SQL from `papers` to `pa_papers` and add new enrichment columns:

```python
CREATE TABLE IF NOT EXISTS pa_papers (
  pmid TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT,
  journal TEXT,
  pub_date TEXT,
  abstract TEXT,
  abstract_structured TEXT,
  mesh_terms TEXT,
  author_keywords TEXT,
  affiliations TEXT,
  doi TEXT,
  pmcid TEXT,
  full_text_sections TEXT,
  nct_ids_cited TEXT,
  is_oa INTEGER,
  oa_url TEXT,
  oa_status TEXT,
  category TEXT,
  relevance_score REAL,
  last_updated TEXT
);
CREATE INDEX IF NOT EXISTS idx_pa_papers_category ON pa_papers(category);
CREATE INDEX IF NOT EXISTS idx_pa_papers_pub_date ON pa_papers(pub_date);
CREATE INDEX IF NOT EXISTS idx_pa_papers_doi ON pa_papers(doi);
```

Update all references from `papers` to `pa_papers` throughout the file — INSERT statements, SELECT queries, etc. The INSERT should now include placeholders for the new columns (set to NULL initially):

```python
conn.execute(
    "INSERT OR REPLACE INTO pa_papers VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    (p["pmid"], p["title"], p["authors"], p["journal"], p["pub_date"],
     p["abstract"], None, json.dumps(p["mesh_terms"]), None, None,
     None, None, None, None, None, None, None, cat, score, now),
)
```

- [ ] **Step 2: Update trials table CREATE SQL**

Change `trials` to `tr_trials`:

```python
CREATE TABLE IF NOT EXISTS tr_trials (
  nct_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  phase TEXT,
  study_type TEXT,
  sponsor TEXT,
  enrollment INTEGER,
  start_date TEXT,
  end_date TEXT,
  interventions TEXT,
  summary TEXT,
  conditions TEXT,
  category TEXT,
  relevance_score REAL,
  last_updated TEXT,
  raw_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_tr_trials_category ON tr_trials(category);
CREATE INDEX IF NOT EXISTS idx_tr_trials_status ON tr_trials(status);
```

Update all references from `trials` to `tr_trials` throughout the file.

- [ ] **Step 3: Update pipeline_meta references**

Change `pipeline_meta` to use `rs_stats`:

```python
CREATE TABLE IF NOT EXISTS rs_stats (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

Update all `pipeline_meta` references to `rs_stats`.

- [ ] **Step 4: Run fetch script to verify table creation**

```bash
cd /Users/ville/projects/cluster-headache-hub
python scripts/fetch-research.py --db public/data.db --skip-fetch
```

Expected: Script runs without SQL errors. Verify tables exist:
```bash
sqlite3 public/data.db ".tables" | grep -E "pa_|tr_|rs_"
```

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-research.py
git commit -m "refactor: rename tables to prefixed convention (pa_, tr_, rs_) in fetch-research.py"
```

---

### Task 2: Rename tables in `analyze-research.py`

**Files:**
- Modify: `scripts/analyze-research.py`

- [ ] **Step 1: Update paper_analyses table to pa_analyses**

Change the CREATE TABLE and all references:

```python
CREATE TABLE IF NOT EXISTS pa_analyses (
    pmid TEXT PRIMARY KEY,
    study_type TEXT,
    result TEXT,
    sample_size INTEGER,
    evidence_tier INTEGER,
    analysis_source TEXT DEFAULT 'regex'
)
```

Add `analysis_source` column — all regex-classified papers get `'regex'`. Update all `paper_analyses` references to `pa_analyses`.

- [ ] **Step 2: Update all paper/trial table references**

Change all SQL queries that reference `papers` to `pa_papers` and `trials` to `tr_trials`.

- [ ] **Step 3: Run analysis script to verify**

```bash
python scripts/analyze-research.py --db public/data.db
```

Expected: No SQL errors. Check:
```bash
sqlite3 public/data.db "SELECT COUNT(*) FROM pa_analyses"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/analyze-research.py
git commit -m "refactor: rename paper_analyses to pa_analyses, update table refs in analyze-research.py"
```

---

### Task 3: Rename tables in `build-analysis-db.py`

**Files:**
- Modify: `scripts/build-analysis-db.py`

- [ ] **Step 1: Prefix all forum tables with `cb_`**

Update the SCHEMA string:
- `forum_stats` → `cb_forum_stats`
- `treatment_rankings` → `cb_treatment_rankings`
- `outcomes` → `cb_outcomes`
- `timeline` → `cb_timeline`
- `co_occurrence` → `cb_co_occurrence`
- `treatment_profiles` → `cb_treatment_profiles`
- `recommendation_data` → `cb_recommendation_data`
- `insights` → `cb_insights`

- [ ] **Step 2: Rename community_groups to co_groups**

Update the community groups table creation and all INSERT references.

- [ ] **Step 3: Update all INSERT/SELECT statements**

Search and replace all unprefixed table names in the file with their prefixed versions.

- [ ] **Step 4: Run build script to verify**

```bash
python scripts/build-analysis-db.py
sqlite3 data/analysis.db ".tables"
```

Expected: All tables have prefixes (`cb_`, `co_`).

- [ ] **Step 5: Commit**

```bash
git add scripts/build-analysis-db.py
git commit -m "refactor: prefix all tables in build-analysis-db.py (cb_, co_)"
```

---

### Task 4: Update `llm-analyze.py` to write to DB instead of JSON

**Files:**
- Modify: `scripts/llm-analyze.py`

- [ ] **Step 1: Create `tr_analyses` table in DB**

Replace the JSON file read/write with database operations. Add table creation:

```python
def ensure_tr_analyses_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tr_analyses (
            nct_id TEXT PRIMARY KEY,
            what_tested TEXT,
            key_result TEXT,
            verdict TEXT,
            patient_relevance TEXT,
            dose_tested TEXT,
            sample_size INTEGER
        )
    """)
    conn.commit()
```

- [ ] **Step 2: Replace JSON load with DB query**

Replace:
```python
with open(TRIAL_ANALYSES_PATH) as f:
    existing_list = json.load(f)
existing = {a["nct_id"]: a for a in existing_list}
```

With:
```python
rows = conn.execute("SELECT nct_id, what_tested, key_result, verdict, patient_relevance, dose_tested, sample_size FROM tr_analyses").fetchall()
existing = {r[0]: {
    "nct_id": r[0], "what_tested": r[1], "key_result": r[2],
    "verdict": r[3], "patient_relevance": r[4], "dose_tested": r[5],
    "sample_size": r[6],
} for r in rows}
```

- [ ] **Step 3: Replace JSON write with DB insert**

Replace the final `json.dump()` with:

```python
for a in new_analyses:
    conn.execute(
        "INSERT OR REPLACE INTO tr_analyses VALUES (?,?,?,?,?,?,?)",
        (a["nct_id"], a["what_tested"], a["key_result"], a["verdict"],
         a["patient_relevance"], a["dose_tested"], a.get("sample_size")),
    )
conn.commit()
```

- [ ] **Step 4: Update trial table reference from `trials` to `tr_trials`**

Change the SELECT query that loads trials for analysis.

- [ ] **Step 5: Seed `tr_analyses` from existing JSON**

Add a migration step that runs once — reads `trial-analyses.json` and inserts all entries into `tr_analyses`:

```python
def seed_from_json(conn):
    """One-time migration from JSON to DB."""
    if conn.execute("SELECT COUNT(*) FROM tr_analyses").fetchone()[0] > 0:
        return  # already seeded
    json_path = os.path.join(PROJECT_ROOT, "src", "data", "trials", "trial-analyses.json")
    if not os.path.exists(json_path):
        return
    with open(json_path) as f:
        analyses = json.load(f)
    for a in analyses:
        conn.execute(
            "INSERT OR REPLACE INTO tr_analyses VALUES (?,?,?,?,?,?,?)",
            (a["nct_id"], a.get("what_tested"), a.get("key_result"),
             a.get("verdict"), a.get("patient_relevance"),
             a.get("dose_tested"), a.get("sample_size")),
        )
    conn.commit()
    print(f"  Seeded {len(analyses)} trial analyses from JSON")
```

Call this after `ensure_tr_analyses_table()`.

- [ ] **Step 6: Run and verify**

```bash
python scripts/llm-analyze.py --db public/data.db --dry-run
sqlite3 public/data.db "SELECT COUNT(*) FROM tr_analyses"
```

Expected: ~956 rows (matching JSON file).

- [ ] **Step 7: Commit**

```bash
git add scripts/llm-analyze.py
git commit -m "refactor: write trial analyses to DB (tr_analyses) instead of JSON"
```

---

### Task 5: Update `update-all.py` merge logic

**Files:**
- Modify: `scripts/update-all.py`

- [ ] **Step 1: Update merge function for prefixed tables**

The `merge_analysis_into_data()` function copies tables from `analysis.db` into `data.db`. It already copies all tables dynamically, so the prefixed names will work automatically. However, update any hardcoded table references.

Also update references from `papers` → `pa_papers`, `trials` → `tr_trials`, `pipeline_meta` → `rs_stats`.

- [ ] **Step 2: Verify full pipeline runs**

```bash
python scripts/update-all.py --skip-fetch
sqlite3 public/data.db ".tables"
```

Expected: All tables have proper prefixes. No unprefixed tables remain.

- [ ] **Step 3: Commit**

```bash
git add scripts/update-all.py
git commit -m "refactor: update merge logic for prefixed table names"
```

---

## Phase 2: Frontend Migration to DB-Only

### Task 6: Update data-db.tsx types and queries for new table names

**Files:**
- Modify: `src/lib/data-db.tsx`

- [ ] **Step 1: Add new type interfaces**

Add these interfaces after existing ones:

```typescript
export interface PaperAnalysis {
  pmid: string
  outcome: string
  plainSummary: string
  keyFinding: string
  sampleSize: number | null
  studyType: string
  evidenceTier: number
  interventionsStudied: string[]
  analysisSource: string
}

export interface TrialAnalysis {
  nctId: string
  whatTested: string
  keyResult: string
  verdict: string
  patientRelevance: string
  doseTested: string | null
  sampleSize: number | null
}

export interface PaperTrialLink {
  pmid: string
  nctId: string
  linkType: "confirmed" | "related"
}

export interface CategoryStats {
  category: string
  paperCount: number
  trialCount: number
  activeTrialCount: number
  positiveOutcomeCount: number
  avgEvidenceTier: number
  oaRate: number
  papersLinkedToTrials: number
  topAuthors: Array<{ name: string; count: number }>
  topInstitutions: Array<{ name: string; count: number }>
  papersPerYear: Record<string, number>
  studyTypeDistribution: Array<{ type: string; count: number }>
  resultDistribution: Array<{ result: string; count: number }>
}
```

- [ ] **Step 2: Update ResearchPaper interface with new fields**

```typescript
export interface ResearchPaper {
  pmid: string
  title: string
  authors: string
  journal: string
  pubDate: string
  abstract: string
  abstractStructured: Record<string, string> | null
  meshTerms: string[]
  authorKeywords: string[]
  affiliations: string[]
  doi: string | null
  pmcid: string | null
  fullTextSections: Record<string, string> | null
  nctIdsCited: string[]
  isOa: boolean
  oaUrl: string | null
  oaStatus: string | null
  category: string
  relevanceScore: number
}
```

- [ ] **Step 3: Update all SQL queries to use prefixed table names**

Replace every occurrence:
- `FROM papers` → `FROM pa_papers`
- `FROM trials` → `FROM tr_trials`
- `FROM paper_analyses` → `FROM pa_analyses`
- `FROM pipeline_meta` → `FROM rs_stats`
- `FROM forum_stats` → `FROM cb_forum_stats`
- `FROM treatment_rankings` → `FROM cb_treatment_rankings`
- `FROM treatment_profiles` → `FROM cb_treatment_profiles`
- `FROM outcomes` → `FROM cb_outcomes`
- `FROM timeline` → `FROM cb_timeline`
- `FROM co_occurrence` → `FROM cb_co_occurrence`
- `FROM insights` → `FROM cb_insights`
- `FROM recommendation_data` → `FROM cb_recommendation_data`
- `FROM community_groups` → `FROM co_groups`

- [ ] **Step 4: Update mapPaper() for new columns**

```typescript
function mapPaper(row: unknown[]): ResearchPaper {
  return {
    pmid: row[0] as string,
    title: row[1] as string,
    authors: row[2] as string,
    journal: row[3] as string,
    pubDate: row[4] as string,
    abstract: row[5] as string,
    abstractStructured: parseJsonSafe(row[6] as string, null),
    meshTerms: parseJsonSafe(row[7] as string, []),
    authorKeywords: parseJsonSafe(row[8] as string, []),
    affiliations: parseJsonSafe(row[9] as string, []),
    doi: row[10] as string | null,
    pmcid: row[11] as string | null,
    fullTextSections: parseJsonSafe(row[12] as string, null),
    nctIdsCited: parseJsonSafe(row[13] as string, []),
    isOa: (row[14] as number) === 1,
    oaUrl: row[15] as string | null,
    oaStatus: row[16] as string | null,
    category: row[17] as string,
    relevanceScore: row[18] as number,
  }
}
```

Update `searchPapers()` SELECT to include all new columns.

- [ ] **Step 5: Add new query functions**

```typescript
getTrialAnalysis(nctId: string): TrialAnalysis | null
```
Query: `SELECT nct_id, what_tested, key_result, verdict, patient_relevance, dose_tested, sample_size FROM tr_analyses WHERE nct_id = ?`

```typescript
getPaperAnalysis(pmid: string): PaperAnalysis | null
```
Query: `SELECT pmid, outcome, plain_summary, key_finding, sample_size, study_type, evidence_tier, interventions_studied, analysis_source FROM pa_analyses WHERE pmid = ?`

```typescript
getLinkedPapers(nctId: string): Array<ResearchPaper & { linkType: string }>
```
Query: `SELECT p.*, l.link_type FROM pa_papers p JOIN rs_paper_trial_links l ON p.pmid = l.pmid WHERE l.nct_id = ? ORDER BY l.link_type, p.pub_date DESC`

```typescript
getLinkedTrials(pmid: string): Array<ResearchTrial & { linkType: string }>
```
Query: `SELECT t.*, l.link_type FROM tr_trials t JOIN rs_paper_trial_links l ON t.nct_id = l.nct_id WHERE l.pmid = ? ORDER BY l.link_type`

```typescript
getCategoryStats(category: string): CategoryStats | null
```
Query: `SELECT * FROM rs_category_stats WHERE category = ?`

```typescript
getResearchStats(): Record<string, unknown>
```
Query: `SELECT key, value FROM rs_stats` — returns as object with parsed JSON values.

- [ ] **Step 6: Add these to the context value and useDataDb hook**

Add all new functions to the `DataDbContextValue` interface and the provider value.

- [ ] **Step 7: Run typecheck**

```bash
npm run typecheck
```

Expected: May have errors in components still importing JSON — those get fixed in next tasks.

- [ ] **Step 8: Commit**

```bash
git add src/lib/data-db.tsx
git commit -m "refactor: update data-db to prefixed tables, add new query functions"
```

---

### Task 7: Migrate active-trials.tsx from JSON to DB

**Files:**
- Modify: `src/pages/active-trials.tsx`

- [ ] **Step 1: Remove JSON import, use DB query**

Remove:
```typescript
import trialAnalyses from "@/data/trials/trial-analyses.json"
```

Update TrialAnalysis component to use the DB hook:

```typescript
function TrialAnalysis({ nctId }: { nctId: string }) {
  const { getTrialAnalysis } = useDataDb()
  const analysis = getTrialAnalysis(nctId)
  if (!analysis) return null

  const badge = VERDICT_BADGES[analysis.verdict]

  return (
    <div className="mb-4 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
        {analysis.doseTested && (
          <Badge variant="outline" className="text-[0.6rem]">{analysis.doseTested}</Badge>
        )}
      </div>
      {analysis.whatTested && (
        <p className="text-xs leading-relaxed">
          <span className="font-medium">What was tested: </span>
          <span className="text-muted-foreground">{analysis.whatTested}</span>
        </p>
      )}
      {analysis.keyResult && (
        <p className="mt-1.5 text-xs leading-relaxed">
          <span className="font-medium">Result: </span>
          <span className="text-muted-foreground">{analysis.keyResult}</span>
        </p>
      )}
      {analysis.patientRelevance && (
        <p className="mt-1.5 text-xs leading-relaxed">
          <span className="font-medium">For patients: </span>
          <span className="text-muted-foreground">{analysis.patientRelevance}</span>
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Remove TrialAnalysisData interface**

It's replaced by the `TrialAnalysis` type from data-db.tsx.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/active-trials.tsx
git commit -m "refactor: load trial analyses from DB instead of JSON import"
```

---

### Task 8: Migrate evidence.tsx from JSON to DB

**Files:**
- Modify: `src/pages/research/evidence.tsx`

- [ ] **Step 1: Remove JSON imports**

Remove:
```typescript
import paperStats from "@/data/research-insights/paper-stats.json"
import trialStats from "@/data/research-insights/trial-stats.json"
```

- [ ] **Step 2: Load stats from DB**

Replace the static imports with DB queries:

```typescript
export function EvidenceDashboard() {
  const { loading, getResearchStats } = useDataDb()

  const stats = useMemo(() => {
    if (loading) return null
    return getResearchStats()
  }, [loading, getResearchStats])

  if (loading || !stats) {
    return <Skeleton className="h-96 w-full" />
  }

  const resultDistribution = stats.result_distribution as Array<{ result: string; count: number }>
  const studyTypeDistribution = stats.study_type_distribution as Array<{ type: string; count: number }>
  const evidenceTierDistribution = stats.evidence_tier_distribution as Array<{ tier: number; count: number }>
  const categoryResults = stats.category_results as Record<string, Array<{ result: string; count: number }>>
  const categoryAvgEvidence = stats.category_avg_evidence as Record<string, number>
  const trialStatusDistribution = stats.trial_status_distribution as Array<{ status: string; count: number }>
  const trialTopSponsors = stats.trial_top_sponsors as Array<{ sponsor: string; count: number }>
  const totalPapers = stats.paper_count as number
  const totalTrials = stats.trial_count as number
  // ... rest of component uses these variables instead of paperStats.* / trialStats.*
```

- [ ] **Step 3: Update all data references**

Replace throughout the component:
- `paperStats.total_papers` → `totalPapers`
- `paperStats.result_distribution` → `resultDistribution`
- `paperStats.study_type_distribution` → `studyTypeDistribution`
- `paperStats.evidence_tier_distribution` → `evidenceTierDistribution`
- `paperStats.category_results` → `categoryResults`
- `paperStats.category_avg_evidence` → `categoryAvgEvidence`
- `trialStats.total_trials` → `totalTrials`
- `trialStats.status_distribution` → `trialStatusDistribution`
- `trialStats.top_sponsors` → `trialTopSponsors`

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/research/evidence.tsx
git commit -m "refactor: load evidence dashboard stats from DB instead of JSON"
```

---

### Task 9: Migrate landscape.tsx from JSON to DB

**Files:**
- Modify: `src/pages/research/landscape.tsx`

- [ ] **Step 1: Remove JSON import and load from DB**

Remove:
```typescript
import paperStats from "@/data/research-insights/paper-stats.json"
```

Replace with DB query pattern (same as evidence.tsx — use `getResearchStats()`).

- [ ] **Step 2: Update all paperStats references**

Replace `paperStats.*` with variables extracted from `stats` object, same pattern as Task 8.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/research/landscape.tsx
git commit -m "refactor: load landscape stats from DB instead of JSON"
```

---

### Task 10: Migrate category.tsx from JSON glob to DB

**Files:**
- Modify: `src/pages/research/category.tsx`

- [ ] **Step 1: Remove glob import**

Remove:
```typescript
const categoryModules = import.meta.glob("@/data/research-insights/categories/*.json", { eager: true }) as Record<string, { default: CategoryData }>
```

And remove the `getCategoryData()` helper function.

- [ ] **Step 2: Load category data from DB**

```typescript
export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const { loading, getCategoryStats, getResearchStats } = useDataDb()

  const data = useMemo(() => {
    if (loading || !slug) return null
    return getCategoryStats(slug)
  }, [loading, slug, getCategoryStats])

  if (!slug || (!loading && !data)) {
    return <Navigate to="/research" replace />
  }
  // ...
```

- [ ] **Step 3: Update CategoryData references to CategoryStats type**

The `CategoryStats` type from data-db.tsx replaces the local `CategoryData` interface. Update all field references accordingly. The trial listing and top papers will need separate queries from the DB — add `getTrialsByCategory(category)` and `getTopPapersByCategory(category)` to data-db.tsx if needed.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/research/category.tsx src/lib/data-db.tsx
git commit -m "refactor: load category data from DB instead of JSON glob"
```

---

### Task 11: Update remaining frontend table references

**Files:**
- Modify: any component still referencing old table names

- [ ] **Step 1: Search for any remaining unprefixed table references**

```bash
cd /Users/ville/projects/cluster-headache-hub
grep -rn "FROM papers\b\|FROM trials\b\|FROM forum_stats\|FROM treatment_rankings\|FROM outcomes\b\|FROM timeline\b\|FROM co_occurrence\|FROM treatment_profiles\|FROM insights\b\|FROM recommendation_data\|FROM community_groups\|FROM paper_analyses\|FROM pipeline_meta" src/
```

Fix any remaining references to use prefixed names.

- [ ] **Step 2: Run full typecheck and build**

```bash
npm run typecheck
npm run build
```

Expected: Both pass.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: ensure all frontend queries use prefixed table names"
```

---

## Phase 3: Pipeline Enrichment

### Task 12: Add EFETCH enrichment to `fetch-research.py`

**Files:**
- Modify: `scripts/fetch-research.py`

- [ ] **Step 1: Add EFETCH XML parsing functions**

```python
import xml.etree.ElementTree as ET

def parse_efetch_xml(xml_text):
    """Parse EFETCH XML response, return dict of pmid -> enrichment data."""
    results = {}
    root = ET.fromstring(xml_text)
    for article in root.findall(".//PubmedArticle"):
        pmid_el = article.find(".//PMID")
        if pmid_el is None:
            continue
        pmid = pmid_el.text

        data = {}

        # Structured abstract
        abstract_parts = {}
        for at in article.findall(".//AbstractText"):
            label = at.get("Label", "").lower()
            text = "".join(at.itertext()).strip()
            if label and text:
                abstract_parts[label] = text
        data["abstract_structured"] = json.dumps(abstract_parts) if abstract_parts else None

        # Author keywords
        keywords = [kw.text for kw in article.findall(".//Keyword") if kw.text]
        data["author_keywords"] = json.dumps(keywords) if keywords else None

        # Affiliations
        affiliations = list(set(
            aff.text for aff in article.findall(".//AffiliationInfo/Affiliation")
            if aff.text
        ))
        data["affiliations"] = json.dumps(affiliations) if affiliations else None

        # DOI
        doi = None
        for aid in article.findall(".//ArticleId"):
            if aid.get("IdType") == "doi" and aid.text:
                doi = aid.text
                break
        data["doi"] = doi

        # PMCID
        pmcid = None
        for aid in article.findall(".//ArticleId"):
            if aid.get("IdType") == "pmc" and aid.text:
                pmcid = aid.text
                break
        data["pmcid"] = pmcid

        # NCT IDs cited in abstract
        full_abstract = " ".join(
            "".join(at.itertext()) for at in article.findall(".//AbstractText")
        )
        nct_ids = list(set(re.findall(r"NCT\d{8}", full_abstract)))
        data["nct_ids_cited"] = json.dumps(nct_ids) if nct_ids else None

        results[pmid] = data
    return results
```

- [ ] **Step 2: Add EFETCH batch function**

```python
def enrich_papers_efetch(conn, api_key=None):
    """Fetch structured metadata via EFETCH for papers not yet enriched."""
    cursor = conn.execute("SELECT pmid FROM pa_papers WHERE doi IS NULL")
    pmids = [row[0] for row in cursor.fetchall()]
    if not pmids:
        print("  All papers already enriched via EFETCH")
        return

    print(f"  Enriching {len(pmids)} papers via EFETCH...")
    delay = 0.1 if api_key else 0.35
    batch_size = 200

    for i in range(0, len(pmids), batch_size):
        batch = pmids[i:i + batch_size]
        params = {
            "db": "pubmed",
            "id": ",".join(batch),
            "retmode": "xml",
        }
        if api_key:
            params["api_key"] = api_key

        try:
            resp = requests.get(EFETCH, params=params, timeout=30)
            resp.raise_for_status()
            enrichments = parse_efetch_xml(resp.text)

            for pmid, data in enrichments.items():
                conn.execute("""
                    UPDATE pa_papers SET
                        abstract_structured = ?,
                        author_keywords = ?,
                        affiliations = ?,
                        doi = ?,
                        pmcid = ?,
                        nct_ids_cited = ?
                    WHERE pmid = ? AND doi IS NULL
                """, (
                    data["abstract_structured"],
                    data["author_keywords"],
                    data["affiliations"],
                    data["doi"],
                    data["pmcid"],
                    data["nct_ids_cited"],
                    pmid,
                ))
            conn.commit()
            print(f"    Enriched batch {i//batch_size + 1} ({len(enrichments)} papers)")
        except Exception as e:
            print(f"    EFETCH batch error: {e}")

        time.sleep(delay)
```

- [ ] **Step 3: Call from main function**

Add after the existing paper insertion loop:

```python
# Phase B: EFETCH enrichment
api_key = os.environ.get("NCBI_API_KEY")
enrich_papers_efetch(conn, api_key)
```

- [ ] **Step 4: Run with a small test**

```bash
python scripts/fetch-research.py --db public/data.db --skip-fetch
```

The `--skip-fetch` flag should skip the PubMed/CT.gov fetch but still run enrichment on existing papers.

- [ ] **Step 5: Verify enrichment**

```bash
sqlite3 public/data.db "SELECT COUNT(*) FROM pa_papers WHERE doi IS NOT NULL"
sqlite3 public/data.db "SELECT pmid, doi, pmcid, nct_ids_cited FROM pa_papers WHERE nct_ids_cited IS NOT NULL LIMIT 5"
```

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-research.py
git commit -m "feat: add EFETCH enrichment — structured abstracts, DOI, PMCID, NCT citations"
```

---

### Task 13: Add full text retrieval (PMC, Europe PMC, Unpaywall)

**Files:**
- Modify: `scripts/fetch-research.py`

- [ ] **Step 1: Add PMC full text fetch function**

```python
def fetch_pmc_fulltext(pmcid, api_key=None):
    """Fetch full text XML from PMC."""
    params = {"db": "pmc", "id": pmcid, "retmode": "xml"}
    if api_key:
        params["api_key"] = api_key
    try:
        resp = requests.get(EFETCH, params=params, timeout=30)
        resp.raise_for_status()
        return extract_fulltext_sections(resp.text)
    except Exception:
        return None

def fetch_europepmc_fulltext(pmcid):
    """Fetch full text XML from Europe PMC."""
    url = f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML"
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            return extract_fulltext_sections(resp.text)
    except Exception:
        pass
    return None

def extract_fulltext_sections(xml_text):
    """Extract results, discussion, conclusion sections from PMC XML."""
    sections = {}
    try:
        root = ET.fromstring(xml_text)
        for sec in root.findall(".//sec"):
            sec_type = (sec.get("sec-type") or "").lower()
            title_el = sec.find("title")
            title = (title_el.text or "").lower() if title_el is not None else ""

            key = None
            if "result" in sec_type or "result" in title:
                key = "results"
            elif "discussion" in sec_type or "discussion" in title:
                key = "discussion"
            elif "conclusion" in sec_type or "conclusion" in title:
                key = "conclusion"

            if key and key not in sections:
                text = " ".join(sec.itertext()).strip()
                if len(text) > 50:  # skip trivially short sections
                    sections[key] = text[:10000]  # cap at 10k chars per section
    except Exception:
        pass
    return sections if sections else None
```

- [ ] **Step 2: Add full text retrieval orchestration**

```python
def retrieve_full_texts(conn, api_key=None):
    """Waterfall: PMC -> Europe PMC -> Unpaywall HTML. Stop on first success."""
    cursor = conn.execute(
        "SELECT pmid, pmcid, oa_url FROM pa_papers WHERE full_text_sections IS NULL AND (pmcid IS NOT NULL OR oa_url IS NOT NULL)"
    )
    papers = cursor.fetchall()
    if not papers:
        print("  No papers need full text retrieval")
        return

    print(f"  Attempting full text retrieval for {len(papers)} papers...")
    delay = 0.1 if api_key else 0.35
    found = 0

    for pmid, pmcid, oa_url in papers:
        sections = None

        # 1. PMC
        if pmcid and not sections:
            sections = fetch_pmc_fulltext(pmcid, api_key)
            time.sleep(delay)

        # 2. Europe PMC
        if pmcid and not sections:
            sections = fetch_europepmc_fulltext(pmcid)
            time.sleep(0.1)

        # 3. Unpaywall HTML (skip PDFs)
        if not sections and oa_url and not oa_url.endswith(".pdf"):
            try:
                resp = requests.get(oa_url, timeout=15, headers={"User-Agent": "ClusterHeadacheHub/1.0"})
                if resp.status_code == 200 and "text/html" in resp.headers.get("content-type", ""):
                    # Basic HTML text extraction
                    text = re.sub(r"<script[^>]*>[\s\S]*?</script>", "", resp.text)
                    text = re.sub(r"<style[^>]*>[\s\S]*?</style>", "", text)
                    text = re.sub(r"<[^>]+>", " ", text)
                    text = re.sub(r"\s+", " ", text).strip()
                    if len(text) > 500:
                        sections = {"full_text": text[:20000]}
            except Exception:
                pass
            time.sleep(1)  # Unpaywall rate limit

        if sections:
            conn.execute(
                "UPDATE pa_papers SET full_text_sections = ? WHERE pmid = ?",
                (json.dumps(sections), pmid),
            )
            found += 1

    conn.commit()
    print(f"  Retrieved full text for {found}/{len(papers)} papers")
```

- [ ] **Step 3: Add Unpaywall OA status fetch**

```python
def fetch_unpaywall_status(conn):
    """Fetch OA status from Unpaywall for papers with DOI."""
    cursor = conn.execute(
        "SELECT pmid, doi FROM pa_papers WHERE doi IS NOT NULL AND oa_status IS NULL"
    )
    papers = cursor.fetchall()
    if not papers:
        print("  All papers already have OA status")
        return

    print(f"  Fetching Unpaywall OA status for {len(papers)} papers...")
    found = 0
    for pmid, doi in papers:
        try:
            resp = requests.get(
                f"https://api.unpaywall.org/v2/{doi}",
                params={"email": "ville.vuori@willba.app"},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                is_oa = 1 if data.get("is_oa") else 0
                oa_url = None
                best_loc = data.get("best_oa_location")
                if best_loc:
                    oa_url = best_loc.get("url_for_landing_page") or best_loc.get("url")
                oa_status = data.get("oa_status", "closed")
                conn.execute(
                    "UPDATE pa_papers SET is_oa = ?, oa_url = ?, oa_status = ? WHERE pmid = ?",
                    (is_oa, oa_url, oa_status, pmid),
                )
                found += 1
        except Exception as e:
            print(f"    Unpaywall error for {doi}: {e}")
        time.sleep(1)  # strict 1 req/sec

    conn.commit()
    print(f"  Got OA status for {found}/{len(papers)} papers")
```

- [ ] **Step 4: Wire into main function**

After EFETCH enrichment:
```python
# Phase C: Full text retrieval
retrieve_full_texts(conn, api_key)

# Phase D: Unpaywall OA status
fetch_unpaywall_status(conn)
```

- [ ] **Step 5: Run and verify**

```bash
python scripts/fetch-research.py --db public/data.db --skip-fetch
sqlite3 public/data.db "SELECT COUNT(*) FROM pa_papers WHERE full_text_sections IS NOT NULL"
sqlite3 public/data.db "SELECT COUNT(*) FROM pa_papers WHERE is_oa = 1"
```

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-research.py
git commit -m "feat: add full text retrieval (PMC/EuropePMC/Unpaywall) and OA status"
```

---

## Phase 4: AI Analysis of Papers

### Task 14: Add paper AI analysis to `llm-analyze.py`

**Files:**
- Modify: `scripts/llm-analyze.py`

- [ ] **Step 1: Add pa_analyses table creation**

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
            analysis_source TEXT DEFAULT 'ai'
        )
    """)
    conn.commit()
```

- [ ] **Step 2: Add paper analysis prompt**

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
  "interventions_studied": ["treatment1"]
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
- basic_science = no treatment was tested (lab research, imaging, genetics)"""
```

- [ ] **Step 3: Add paper analysis function**

```python
def analyze_papers(conn, api_key, base_url, model):
    """AI analysis of papers with abstracts/full text."""
    ensure_pa_analyses_table(conn)

    # Get papers that need AI analysis (have content, not yet analyzed)
    existing = set(
        r[0] for r in conn.execute("SELECT pmid FROM pa_analyses WHERE analysis_source = 'ai'").fetchall()
    )

    cursor = conn.execute("""
        SELECT pmid, title, authors, journal, pub_date, abstract,
               abstract_structured, full_text_sections, category, mesh_terms
        FROM pa_papers
        WHERE abstract IS NOT NULL AND abstract != ''
    """)
    papers = cursor.fetchall()
    new_papers = [p for p in papers if p[0] not in existing]

    if not new_papers:
        print("  No new papers to analyze")
        return

    print(f"  Analyzing {len(new_papers)} papers with LLM...")

    for i, paper in enumerate(new_papers):
        pmid, title, authors, journal, pub_date, abstract, abstract_structured, full_text_sections, category, mesh_terms = paper
        year = (pub_date or "")[:4]

        # Pick richest content
        content = ""
        if full_text_sections:
            sections = json.loads(full_text_sections)
            content = "\n\n".join(f"[{k.upper()}]\n{v}" for k, v in sections.items())
        elif abstract_structured:
            sections = json.loads(abstract_structured)
            content = "\n\n".join(f"[{k.upper()}]\n{v}" for k, v in sections.items())
        else:
            content = abstract or ""

        if len(content.strip()) < 50:
            continue

        prompt = PAPER_PROMPT.format(
            title=title or "",
            authors=authors or "",
            journal=journal or "",
            year=year,
            category=category or "",
            mesh_terms=mesh_terms or "[]",
            content=content[:8000],  # cap input
        )

        try:
            result = call_llm(prompt, api_key, base_url, model)
            conn.execute(
                "INSERT OR REPLACE INTO pa_analyses VALUES (?,?,?,?,?,?,?,?,?)",
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
                ),
            )
            conn.commit()
            if (i + 1) % 50 == 0:
                print(f"    Analyzed {i + 1}/{len(new_papers)} papers")
        except Exception as e:
            print(f"    Error analyzing PMID {pmid}: {e}")

        time.sleep(1)

    print(f"  Completed AI analysis of papers")
```

- [ ] **Step 4: Backfill regex-only papers into pa_analyses**

After AI analysis, backfill papers that only have regex classification:

```python
def backfill_regex_analyses(conn):
    """Copy regex-classified papers into pa_analyses for papers without AI analysis."""
    conn.execute("""
        INSERT OR IGNORE INTO pa_analyses (pmid, outcome, study_type, sample_size, evidence_tier, analysis_source)
        SELECT
            a.pmid,
            CASE a.result
                WHEN 'positive' THEN 'showed_benefit'
                WHEN 'negative' THEN 'no_benefit'
                WHEN 'mixed' THEN 'mixed'
                WHEN 'inconclusive' THEN 'inconclusive'
                ELSE 'inconclusive'
            END,
            a.study_type,
            a.sample_size,
            a.evidence_tier,
            'regex'
        FROM pa_analyses_legacy a
        WHERE a.pmid NOT IN (SELECT pmid FROM pa_analyses)
    """)
    conn.commit()
```

Note: This requires the old regex `pa_analyses` table to still exist during migration. The `analyze-research.py` script still writes to it.

- [ ] **Step 5: Wire into main function**

Add after trial analysis:

```python
# Paper AI analysis
if api_key:
    analyze_papers(conn, api_key, base_url, model)
```

- [ ] **Step 6: Test with dry run**

```bash
CEREBRAS_API_KEY=test python scripts/llm-analyze.py --db public/data.db --dry-run
```

- [ ] **Step 7: Commit**

```bash
git add scripts/llm-analyze.py
git commit -m "feat: add AI analysis of papers via Cerebras LLM"
```

---

## Phase 5: Cross-Linking & Stats

### Task 15: Add cross-linking to `analyze-research.py`

**Files:**
- Modify: `scripts/analyze-research.py`

- [ ] **Step 1: Create rs_paper_trial_links table and populate confirmed links**

```python
def build_paper_trial_links(conn):
    """Build cross-links between papers and trials."""
    conn.execute("DROP TABLE IF EXISTS rs_paper_trial_links")
    conn.execute("""
        CREATE TABLE rs_paper_trial_links (
            pmid TEXT NOT NULL,
            nct_id TEXT NOT NULL,
            link_type TEXT NOT NULL,
            PRIMARY KEY (pmid, nct_id)
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rs_links_nct ON rs_paper_trial_links(nct_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rs_links_pmid ON rs_paper_trial_links(pmid)")

    # Confirmed links: papers citing NCT IDs
    cursor = conn.execute(
        "SELECT pmid, nct_ids_cited FROM pa_papers WHERE nct_ids_cited IS NOT NULL"
    )
    trial_ids = set(r[0] for r in conn.execute("SELECT nct_id FROM tr_trials").fetchall())

    confirmed = 0
    for pmid, nct_json in cursor.fetchall():
        nct_ids = json.loads(nct_json)
        for nct_id in nct_ids:
            if nct_id in trial_ids:
                conn.execute(
                    "INSERT OR IGNORE INTO rs_paper_trial_links VALUES (?, ?, 'confirmed')",
                    (pmid, nct_id),
                )
                confirmed += 1

    # Related links: same category + overlapping interventions
    cursor = conn.execute("""
        SELECT p.pmid, p.category, a.interventions_studied, t.nct_id, t.interventions
        FROM pa_papers p
        JOIN pa_analyses a ON p.pmid = a.pmid
        JOIN tr_trials t ON p.category = t.category
        WHERE a.interventions_studied IS NOT NULL
          AND t.interventions IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM rs_paper_trial_links l
              WHERE l.pmid = p.pmid AND l.nct_id = t.nct_id
          )
    """)

    related = 0
    for pmid, category, paper_interventions_json, nct_id, trial_interventions_json in cursor.fetchall():
        paper_ints = set(i.lower() for i in json.loads(paper_interventions_json))
        trial_ints = set(i.lower() for i in json.loads(trial_interventions_json))
        if paper_ints & trial_ints:  # at least one overlap
            conn.execute(
                "INSERT OR IGNORE INTO rs_paper_trial_links VALUES (?, ?, 'related')",
                (pmid, nct_id),
            )
            related += 1

    conn.commit()
    print(f"  Built {confirmed} confirmed + {related} related paper-trial links")
```

- [ ] **Step 2: Build rs_category_stats and rs_stats**

```python
def build_research_stats(conn):
    """Build rs_category_stats and rs_stats tables."""
    conn.execute("DROP TABLE IF EXISTS rs_category_stats")
    conn.execute("""
        CREATE TABLE rs_category_stats (
            category TEXT PRIMARY KEY,
            paper_count INTEGER,
            trial_count INTEGER,
            active_trial_count INTEGER,
            positive_outcome_count INTEGER,
            avg_evidence_tier REAL,
            oa_rate REAL,
            papers_linked_to_trials INTEGER,
            top_authors TEXT,
            top_institutions TEXT,
            papers_per_year TEXT,
            study_type_distribution TEXT,
            result_distribution TEXT
        )
    """)

    categories = [r[0] for r in conn.execute(
        "SELECT DISTINCT category FROM pa_papers UNION SELECT DISTINCT category FROM tr_trials ORDER BY category"
    ).fetchall()]

    for cat in categories:
        if not cat:
            continue

        paper_count = conn.execute("SELECT COUNT(*) FROM pa_papers WHERE category = ?", (cat,)).fetchone()[0]
        trial_count = conn.execute("SELECT COUNT(*) FROM tr_trials WHERE category = ?", (cat,)).fetchone()[0]
        active_trial_count = conn.execute(
            "SELECT COUNT(*) FROM tr_trials WHERE category = ? AND status IN ('RECRUITING','NOT_YET_RECRUITING','ACTIVE_NOT_RECRUITING')",
            (cat,),
        ).fetchone()[0]

        positive_count = conn.execute(
            "SELECT COUNT(*) FROM pa_analyses a JOIN pa_papers p ON a.pmid = p.pmid WHERE p.category = ? AND a.outcome = 'showed_benefit'",
            (cat,),
        ).fetchone()[0]

        avg_tier = conn.execute(
            "SELECT AVG(a.evidence_tier) FROM pa_analyses a JOIN pa_papers p ON a.pmid = p.pmid WHERE p.category = ? AND a.evidence_tier IS NOT NULL",
            (cat,),
        ).fetchone()[0] or 0

        oa_count = conn.execute("SELECT COUNT(*) FROM pa_papers WHERE category = ? AND is_oa = 1", (cat,)).fetchone()[0]
        oa_rate = oa_count / paper_count if paper_count > 0 else 0

        linked = conn.execute(
            "SELECT COUNT(DISTINCT l.pmid) FROM rs_paper_trial_links l JOIN pa_papers p ON l.pmid = p.pmid WHERE p.category = ?",
            (cat,),
        ).fetchone()[0]

        # Top authors
        authors_raw = conn.execute("SELECT authors FROM pa_papers WHERE category = ? AND authors IS NOT NULL", (cat,)).fetchall()
        author_counts = Counter()
        for (authors_str,) in authors_raw:
            first = authors_str.split(",")[0].strip() if authors_str else ""
            if first and first != "et al.":
                author_counts[first] += 1
        top_authors = [{"name": n, "count": c} for n, c in author_counts.most_common(10)]

        # Top institutions
        inst_counts = Counter()
        affs_raw = conn.execute("SELECT affiliations FROM pa_papers WHERE category = ? AND affiliations IS NOT NULL", (cat,)).fetchall()
        for (affs_json,) in affs_raw:
            for aff in json.loads(affs_json):
                # Extract institution name (simplify long affiliations)
                parts = aff.split(",")
                inst = parts[0].strip() if parts else aff
                if len(inst) > 5:
                    inst_counts[inst] += 1
        top_institutions = [{"name": n, "count": c} for n, c in inst_counts.most_common(10)]

        # Papers per year
        year_counts = {}
        for (pd,) in conn.execute("SELECT pub_date FROM pa_papers WHERE category = ? AND pub_date IS NOT NULL", (cat,)).fetchall():
            y = pd[:4]
            year_counts[y] = year_counts.get(y, 0) + 1

        # Study type distribution
        study_types = conn.execute(
            "SELECT a.study_type, COUNT(*) FROM pa_analyses a JOIN pa_papers p ON a.pmid = p.pmid WHERE p.category = ? GROUP BY a.study_type ORDER BY COUNT(*) DESC",
            (cat,),
        ).fetchall()
        study_type_dist = [{"type": t, "count": c} for t, c in study_types]

        # Result distribution
        results = conn.execute(
            "SELECT a.outcome, COUNT(*) FROM pa_analyses a JOIN pa_papers p ON a.pmid = p.pmid WHERE p.category = ? GROUP BY a.outcome ORDER BY COUNT(*) DESC",
            (cat,),
        ).fetchall()
        result_dist = [{"result": r, "count": c} for r, c in results]

        conn.execute(
            "INSERT INTO rs_category_stats VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (cat, paper_count, trial_count, active_trial_count, positive_count,
             round(avg_tier, 2), round(oa_rate, 3), linked,
             json.dumps(top_authors), json.dumps(top_institutions),
             json.dumps(year_counts), json.dumps(study_type_dist), json.dumps(result_dist)),
        )

    conn.commit()
    print(f"  Built category stats for {len(categories)} categories")

    # Global rs_stats
    build_global_stats(conn)


def build_global_stats(conn):
    """Build global research stats (rs_stats table)."""
    conn.execute("DROP TABLE IF EXISTS rs_stats")
    conn.execute("CREATE TABLE rs_stats (key TEXT PRIMARY KEY, value TEXT)")

    def put(key, value):
        conn.execute("INSERT INTO rs_stats VALUES (?, ?)", (key, json.dumps(value)))

    put("last_run", datetime.now().isoformat())
    put("paper_count", conn.execute("SELECT COUNT(*) FROM pa_papers").fetchone()[0])
    put("trial_count", conn.execute("SELECT COUNT(*) FROM tr_trials").fetchone()[0])
    put("papers_with_abstracts", conn.execute("SELECT COUNT(*) FROM pa_papers WHERE abstract IS NOT NULL AND abstract != ''").fetchone()[0])
    put("papers_with_full_text", conn.execute("SELECT COUNT(*) FROM pa_papers WHERE full_text_sections IS NOT NULL").fetchone()[0])

    # OA rate
    total = conn.execute("SELECT COUNT(*) FROM pa_papers WHERE doi IS NOT NULL").fetchone()[0]
    oa = conn.execute("SELECT COUNT(*) FROM pa_papers WHERE is_oa = 1").fetchone()[0]
    put("oa_rate", round(oa / total, 3) if total > 0 else 0)

    # Study type distribution
    rows = conn.execute("SELECT study_type, COUNT(*) FROM pa_analyses GROUP BY study_type ORDER BY COUNT(*) DESC").fetchall()
    put("study_type_distribution", [{"type": t, "count": c} for t, c in rows])

    # Result/outcome distribution
    rows = conn.execute("SELECT outcome, COUNT(*) FROM pa_analyses GROUP BY outcome ORDER BY COUNT(*) DESC").fetchall()
    put("result_distribution", [{"result": r, "count": c} for r, c in rows])

    # Evidence tier distribution
    rows = conn.execute("SELECT evidence_tier, COUNT(*) FROM pa_analyses WHERE evidence_tier IS NOT NULL GROUP BY evidence_tier ORDER BY evidence_tier").fetchall()
    put("evidence_tier_distribution", [{"tier": t, "count": c} for t, c in rows])

    # Papers per year
    rows = conn.execute("SELECT SUBSTR(pub_date, 1, 4) as year, COUNT(*) FROM pa_papers WHERE pub_date IS NOT NULL GROUP BY year ORDER BY year").fetchall()
    put("papers_per_year", {y: c for y, c in rows})

    # Category results
    cat_results = {}
    for (cat,) in conn.execute("SELECT DISTINCT category FROM pa_papers WHERE category IS NOT NULL").fetchall():
        rows = conn.execute(
            "SELECT a.outcome, COUNT(*) FROM pa_analyses a JOIN pa_papers p ON a.pmid = p.pmid WHERE p.category = ? GROUP BY a.outcome",
            (cat,),
        ).fetchall()
        cat_results[cat] = [{"result": r, "count": c} for r, c in rows]
    put("category_results", cat_results)

    # Category avg evidence
    rows = conn.execute(
        "SELECT p.category, AVG(a.evidence_tier) FROM pa_analyses a JOIN pa_papers p ON a.pmid = p.pmid WHERE a.evidence_tier IS NOT NULL GROUP BY p.category"
    ).fetchall()
    put("category_avg_evidence", {cat: round(avg, 2) for cat, avg in rows})

    # Trial status distribution
    rows = conn.execute("SELECT status, COUNT(*) FROM tr_trials GROUP BY status ORDER BY COUNT(*) DESC").fetchall()
    put("trial_status_distribution", [{"status": s, "count": c} for s, c in rows])

    # Trial phase distribution
    rows = conn.execute("SELECT phase, COUNT(*) FROM tr_trials GROUP BY phase ORDER BY COUNT(*) DESC").fetchall()
    put("trial_phase_distribution", [{"phase": p, "count": c} for p, c in rows])

    # Top sponsors
    rows = conn.execute("SELECT sponsor, COUNT(*) FROM tr_trials GROUP BY sponsor ORDER BY COUNT(*) DESC LIMIT 15").fetchall()
    put("trial_top_sponsors", [{"sponsor": s, "count": c} for s, c in rows])

    # Avg enrollment by category
    rows = conn.execute("SELECT category, AVG(enrollment) FROM tr_trials WHERE enrollment IS NOT NULL GROUP BY category").fetchall()
    put("trial_avg_enrollment_by_category", {cat: round(avg) for cat, avg in rows})

    # Research volume by category over time
    volume = {}
    for (cat,) in conn.execute("SELECT DISTINCT category FROM pa_papers WHERE category IS NOT NULL").fetchall():
        rows = conn.execute(
            "SELECT SUBSTR(pub_date, 1, 4), COUNT(*) FROM pa_papers WHERE category = ? AND pub_date IS NOT NULL GROUP BY SUBSTR(pub_date, 1, 4)",
            (cat,),
        ).fetchall()
        volume[cat] = {y: c for y, c in rows}
    put("research_volume_by_category", volume)

    # Top authors (global)
    author_counts = Counter()
    for (authors_str,) in conn.execute("SELECT authors FROM pa_papers WHERE authors IS NOT NULL").fetchall():
        first = authors_str.split(",")[0].strip()
        if first and first != "et al.":
            author_counts[first] += 1
    put("top_authors", [{"name": n, "count": c} for n, c in author_counts.most_common(20)])

    # Top institutions (global)
    inst_counts = Counter()
    for (affs_json,) in conn.execute("SELECT affiliations FROM pa_papers WHERE affiliations IS NOT NULL").fetchall():
        for aff in json.loads(affs_json):
            parts = aff.split(",")
            inst = parts[0].strip() if parts else aff
            if len(inst) > 5:
                inst_counts[inst] += 1
    put("top_institutions", [{"name": n, "count": c} for n, c in inst_counts.most_common(20)])

    conn.commit()
    print("  Built global research stats")
```

- [ ] **Step 3: Wire into main function**

Call after paper classification:

```python
build_paper_trial_links(conn)
build_research_stats(conn)
```

- [ ] **Step 4: Run and verify**

```bash
python scripts/analyze-research.py --db public/data.db
sqlite3 public/data.db "SELECT COUNT(*) FROM rs_paper_trial_links WHERE link_type = 'confirmed'"
sqlite3 public/data.db "SELECT key FROM rs_stats LIMIT 10"
sqlite3 public/data.db "SELECT category, paper_count, trial_count FROM rs_category_stats LIMIT 5"
```

- [ ] **Step 5: Verify cross-link for known paper**

```bash
sqlite3 public/data.db "SELECT * FROM rs_paper_trial_links WHERE nct_id = 'NCT02981173'"
```

Expected: At least one confirmed link (from Schindler 2024 paper, PMID 38581739).

- [ ] **Step 6: Commit**

```bash
git add scripts/analyze-research.py
git commit -m "feat: add paper-trial cross-linking and research stats aggregation"
```

---

## Phase 6: Frontend — Enhanced Paper Cards & Trial Links

### Task 16: Update paper cards with AI analysis and OA badges

**Files:**
- Modify: `src/pages/research-search.tsx`

- [ ] **Step 1: Update PaperCard to show AI analysis fields**

Import the new types and add analysis display. In the PaperCard component, after the existing header, add:

```typescript
function PaperCard({
  paper,
  expanded,
  onToggle,
  onAuthorClick,
}: {
  paper: ResearchPaper
  expanded: boolean
  onToggle: () => void
  onAuthorClick: (author: string) => void
}) {
  const { getPaperAnalysis, getLinkedTrials } = useDataDb()
  const analysis = getPaperAnalysis(paper.pmid)
  const linkedTrials = getLinkedTrials(paper.pmid)
```

In the card header (collapsed view), add outcome badge and OA badge:

```tsx
{/* Outcome badge */}
{analysis?.outcome && (
  <Badge variant={OUTCOME_BADGES[analysis.outcome]?.variant ?? "outline"}>
    {OUTCOME_BADGES[analysis.outcome]?.label ?? analysis.outcome}
  </Badge>
)}

{/* Evidence tier */}
{analysis?.evidenceTier && (
  <Badge variant="outline" className="text-[0.6rem]">
    Tier {analysis.evidenceTier}
  </Badge>
)}

{/* OA badge */}
{paper.isOa && paper.oaUrl && (
  <a href={paper.oaUrl} target="_blank" rel="noopener noreferrer">
    <Badge variant="success" className="text-[0.6rem]">Open Access</Badge>
  </a>
)}
```

- [ ] **Step 2: Add outcome badge mapping**

```typescript
const OUTCOME_BADGES: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "secondary" | "outline" }> = {
  showed_benefit: { label: "Showed Benefit", variant: "success" },
  no_benefit: { label: "No Benefit", variant: "destructive" },
  mixed: { label: "Mixed", variant: "warning" },
  inconclusive: { label: "Inconclusive", variant: "secondary" },
  basic_science: { label: "Basic Science", variant: "outline" },
}
```

- [ ] **Step 3: Show AI summary instead of raw abstract in collapsed view**

Replace the abstract display:

```tsx
{analysis?.plainSummary ? (
  <p className="text-xs leading-relaxed text-muted-foreground">{analysis.plainSummary}</p>
) : paper.abstract ? (
  <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">{paper.abstract}</p>
) : null}

{analysis?.keyFinding && (
  <p className="mt-1 text-xs font-medium text-foreground">{analysis.keyFinding}</p>
)}
```

- [ ] **Step 4: Show linked trials in expanded view**

```tsx
{linkedTrials.length > 0 && (
  <div className="mt-3 border-t pt-3">
    <p className="text-xs font-medium mb-2">Linked Clinical Trials</p>
    {linkedTrials.map((trial) => (
      <Link
        key={trial.nctId}
        to={`/trials?q=${trial.nctId}`}
        className="flex items-center gap-2 text-xs text-primary hover:underline"
      >
        <FlaskConical className="size-3" />
        {trial.nctId} — {trial.title}
        <Badge variant={trial.linkType === "confirmed" ? "info" : "outline"} className="text-[0.5rem]">
          {trial.linkType}
        </Badge>
      </Link>
    ))}
  </div>
)}
```

- [ ] **Step 5: Run typecheck and build**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/research-search.tsx
git commit -m "feat: show AI analysis, OA badges, and trial links on paper cards"
```

---

### Task 17: Add linked papers to trial detail

**Files:**
- Modify: `src/pages/active-trials.tsx`

- [ ] **Step 1: Add linked papers section to TrialCard expanded view**

In the TrialCard component, after the existing TrialAnalysis section:

```typescript
function LinkedPapers({ nctId }: { nctId: string }) {
  const { getLinkedPapers } = useDataDb()
  const papers = getLinkedPapers(nctId)

  if (papers.length === 0) return null

  const confirmed = papers.filter((p) => p.linkType === "confirmed")
  const related = papers.filter((p) => p.linkType === "related")

  return (
    <div className="mt-3 border-t pt-3">
      {confirmed.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold mb-1.5">Papers citing this trial ({confirmed.length})</p>
          {confirmed.map((paper) => (
            <a
              key={paper.pmid}
              href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 rounded-md p-2 text-xs hover:bg-muted/50"
            >
              <ExternalLink className="mt-0.5 size-3 shrink-0" />
              <div>
                <span className="font-medium">{paper.title}</span>
                <span className="block text-muted-foreground">{paper.authors} — {paper.journal} ({paper.pubDate?.slice(0, 4)})</span>
              </div>
            </a>
          ))}
        </div>
      )}
      {related.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-1.5">Related papers ({related.length})</p>
          {related.slice(0, 5).map((paper) => (
            <a
              key={paper.pmid}
              href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 rounded-md p-2 text-xs hover:bg-muted/50"
            >
              <ExternalLink className="mt-0.5 size-3 shrink-0" />
              <div>
                <span className="font-medium">{paper.title}</span>
                <span className="block text-muted-foreground">{paper.authors} — {paper.journal} ({paper.pubDate?.slice(0, 4)})</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
```

Add `<LinkedPapers nctId={trial.nctId} />` in the expanded trial card section.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/active-trials.tsx
git commit -m "feat: show linked papers on trial detail cards"
```

---

## Phase 7: Cleanup

### Task 18: Delete obsolete JSON files and imports

**Files:**
- Delete: `src/data/trials/trial-analyses.json`
- Delete: `src/data/trials/all-trials.json`
- Delete: `src/data/research-insights/paper-stats.json`
- Delete: `src/data/research-insights/trial-stats.json`
- Delete: `src/data/research-insights/categories/*.json`
- Modify: any remaining files importing deleted JSONs

- [ ] **Step 1: Search for remaining JSON imports**

```bash
grep -rn "from.*@/data/trials\|from.*@/data/research-insights" src/
```

Fix any remaining imports.

- [ ] **Step 2: Delete JSON files**

```bash
rm src/data/trials/trial-analyses.json
rm src/data/trials/all-trials.json
rm src/data/research-insights/paper-stats.json
rm src/data/research-insights/trial-stats.json
rm -rf src/data/research-insights/categories/
```

- [ ] **Step 3: Update analyze-categories.py**

The script `scripts/analyze-categories.py` generates the category JSON files that we just deleted. Either:
- Remove it entirely (category stats now come from `rs_category_stats`)
- Or update it to write to DB instead

Check `update-all.py` to remove the phase that calls it.

- [ ] **Step 4: Run full build to verify**

```bash
npm run typecheck
npm run build
```

Expected: Both pass with zero errors.

- [ ] **Step 5: Run full pipeline**

```bash
python scripts/update-all.py --skip-fetch
```

Expected: All phases complete, DB has all prefixed tables.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: delete obsolete JSON files, clean up imports"
```

---

### Task 19: Final verification

- [ ] **Step 1: Verify DB schema**

```bash
sqlite3 public/data.db ".tables"
```

Expected: Only prefixed tables (`pa_`, `tr_`, `rs_`, `cb_`, `co_`). No unprefixed tables.

- [ ] **Step 2: Verify cross-link for Schindler 2024**

```bash
sqlite3 public/data.db "SELECT p.title, l.link_type FROM rs_paper_trial_links l JOIN pa_papers p ON l.pmid = p.pmid WHERE l.nct_id = 'NCT02981173'"
```

Expected: At least one result with Schindler paper.

- [ ] **Step 3: Verify AI analysis quality**

```bash
sqlite3 public/data.db "SELECT pmid, outcome, plain_summary, key_finding FROM pa_analyses WHERE analysis_source = 'ai' LIMIT 3"
```

Expected: Human-readable summaries.

- [ ] **Step 4: Verify frontend build**

```bash
npm run build
```

Expected: Clean build with no warnings.

- [ ] **Step 5: Start dev server and verify pages**

```bash
npm run dev
```

Check:
- `/research/papers` — paper cards show AI summaries, outcome badges, OA badges
- `/research/trials` — trial cards load analysis from DB, show linked papers
- `/research/insights/evidence` — dashboard loads stats from DB
- `/research/insights/landscape` — landscape loads from DB
- `/research/category/psychedelic` — category page loads from DB

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: article enrichment, AI analysis, trial cross-linking complete"
```

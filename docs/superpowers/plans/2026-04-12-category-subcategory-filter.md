# Category Subcategory Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dropdown filter on research category pages that lets users drill down to specific treatments/interventions within broad categories (e.g., filter "Pharmacological Treatments" to just verapamil papers and trials).

**Architecture:** Subcategory data is precalculated in the Python pipeline (`analyze-research.py`) and stored in a new `rs_subcategories` DB table. The frontend reads this table via a new query in `data-db.tsx`, and `category.tsx` adds a Select dropdown that filters the papers and trials lists client-side.

**Tech Stack:** Python 3 (pipeline), SQLite, React 19, TypeScript, shadcn/ui Select component

**Spec:** `docs/superpowers/specs/2026-04-12-category-subcategory-filter-design.md`

---

### Task 1: Add `rs_subcategories` table to the Python pipeline

**Files:**
- Modify: `scripts/analyze-research.py` (add `build_subcategories` function after `build_category_stats`, call it from `main`)

- [ ] **Step 1: Add the normalization map and extraction function**

Add this after the `build_category_stats` function (~line 494) in `scripts/analyze-research.py`:

```python
# Normalization map: maps raw lowercase terms to display labels.
# Terms not in this map are title-cased as-is.
TERM_ALIASES = {
    "lithium carbonate": "Lithium",
    "lithium compounds": "Lithium",
    "lithium": "Lithium",
    "verapamil": "Verapamil",
    "verapamil hydrochloride": "Verapamil",
    "r-verapamil": "Verapamil",
    "sumatriptan": "Sumatriptan",
    "sumatriptan succinate": "Sumatriptan",
    "topiramate": "Topiramate",
    "melatonin": "Melatonin",
    "prednisone": "Prednisone",
    "prednisolone": "Prednisolone",
    "methylprednisolone": "Methylprednisolone",
    "indomethacin": "Indomethacin",
    "methysergide": "Methysergide",
    "ergotamine": "Ergotamine",
    "valproic acid": "Valproic Acid",
    "lamotrigine": "Lamotrigine",
    "gabapentin": "Gabapentin",
    "galcanezumab": "Galcanezumab",
    "erenumab": "Erenumab",
    "fremanezumab": "Fremanezumab",
    "psilocybin": "Psilocybin",
    "lysergic acid diethylamide": "LSD",
    "lsd": "LSD",
    "bol-148": "BOL-148",
    "oxygen": "Oxygen",
    "oxygen inhalation therapy": "Oxygen",
    "hyperbaric oxygenation": "Hyperbaric Oxygen",
    "botulinum toxins": "Botulinum Toxin",
    "botulinum toxins, type a": "Botulinum Toxin",
    "botulinum toxin": "Botulinum Toxin",
    "lidocaine": "Lidocaine",
    "bupivacaine": "Bupivacaine",
    "gammacore": "Vagus Nerve Stimulation",
    "vagus nerve stimulation": "Vagus Nerve Stimulation",
    "non-invasive vagus nerve stimulation": "Vagus Nerve Stimulation",
    "transcutaneous vagus nerve stimulation": "Vagus Nerve Stimulation",
    "deep brain stimulation": "Deep Brain Stimulation",
    "occipital nerve stimulation": "Occipital Nerve Stimulation",
    "sphenopalatine ganglion": "SPG Stimulation/Block",
    "sphenopalatine ganglion block": "SPG Stimulation/Block",
    "spg stimulation": "SPG Stimulation/Block",
    "greater occipital nerve": "Occipital Nerve Block",
    "greater occipital nerve block": "Occipital Nerve Block",
    "occipital nerve block": "Occipital Nerve Block",
    "nerve block": "Nerve Block",
    "vitamin d": "Vitamin D",
    "cholecalciferol": "Vitamin D",
    "vitamin d3": "Vitamin D",
    "calcium channel blockers": "Calcium Channel Blockers",
    "adrenal cortex hormones": "Corticosteroids",
    "corticosteroids": "Corticosteroids",
    "triptans": "Triptans",
    "serotonin receptor agonists": "Triptans",
    "anticonvulsants": "Anticonvulsants",
    "calcitonin gene-related peptide": "CGRP",
    "cgrp": "CGRP",
}

# Terms to skip — too generic or not treatment-specific
SKIP_TERMS = {
    "humans", "male", "female", "adult", "middle aged", "young adult", "aged",
    "adolescent", "child", "infant", "cluster headache", "cluster headaches",
    "headache", "headaches", "treatment outcome", "prospective studies",
    "retrospective studies", "migraine", "migraine disorders", "chronic disease",
    "diagnosis, differential", "time factors", "double-blind method",
    "cross-over studies", "pain", "brain", "magnetic resonance imaging",
    "electroencephalography", "follow-up studies", "comorbidity",
    "surveys and questionnaires", "quality of life", "prevalence",
    "risk factors", "severity of illness index",
    "trigeminal autonomic cephalalgia", "trigeminal autonomic cephalalgias",
    "vascular headaches", "tension-type headache",
    "hemicrania continua", "paroxysmal hemicrania",
    "sunct", "suna", "epidemiology", "pathophysiology",
    "case reports", "review", "meta-analysis",
    "clinical trial", "randomized controlled trial",
    "treatment", "drug therapy", "drug therapy, combination",
    "neuromodulation", "neurostimulation",
}


def build_subcategories(conn):
    """Build rs_subcategories table with treatment-specific terms per category."""
    conn.execute("DROP TABLE IF EXISTS rs_subcategories")
    conn.execute("""
        CREATE TABLE rs_subcategories (
            category TEXT NOT NULL,
            term TEXT NOT NULL,
            paper_count INTEGER NOT NULL DEFAULT 0,
            trial_count INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (category, term)
        )
    """)

    categories = [r[0] for r in conn.execute(
        "SELECT DISTINCT category FROM pa_papers WHERE category IS NOT NULL "
        "UNION SELECT DISTINCT category FROM tr_trials WHERE category IS NOT NULL "
        "ORDER BY category"
    ).fetchall()]

    total_rows = 0
    for cat in categories:
        term_paper_counts = Counter()
        term_trial_counts = Counter()

        # Extract from papers: MeSH terms + author keywords
        for (mesh_json, kw_json) in conn.execute(
            "SELECT mesh_terms, author_keywords FROM pa_papers WHERE category = ?", (cat,)
        ).fetchall():
            terms = set()
            for raw_json in (mesh_json, kw_json):
                if not raw_json:
                    continue
                try:
                    for t in json.loads(raw_json):
                        low = t.lower().strip()
                        if low and low not in SKIP_TERMS:
                            normalized = TERM_ALIASES.get(low, t.strip().title())
                            terms.add(normalized)
                except Exception:
                    pass
            for term in terms:
                term_paper_counts[term] += 1

        # Extract from trials: interventions
        for (interv_json,) in conn.execute(
            "SELECT interventions FROM tr_trials WHERE category = ?", (cat,)
        ).fetchall():
            if not interv_json:
                continue
            try:
                terms = set()
                for t in json.loads(interv_json):
                    low = t.lower().strip()
                    if low and low not in SKIP_TERMS:
                        normalized = TERM_ALIASES.get(low, t.strip().title())
                        terms.add(normalized)
                for term in terms:
                    term_trial_counts[term] += 1
            except Exception:
                pass

        # Merge and insert — all terms, no minimum threshold
        all_terms = set(term_paper_counts.keys()) | set(term_trial_counts.keys())
        for term in all_terms:
            pc = term_paper_counts.get(term, 0)
            tc = term_trial_counts.get(term, 0)
            conn.execute(
                "INSERT INTO rs_subcategories (category, term, paper_count, trial_count) VALUES (?, ?, ?, ?)",
                (cat, term, pc, tc),
            )
            total_rows += 1

    conn.commit()
    print(f"  Built subcategories: {total_rows} terms across {len(categories)} categories", flush=True)
```

- [ ] **Step 2: Call `build_subcategories` from `main()`**

In the `main()` function (~line 639), add the call after `build_category_stats`:

```python
    build_paper_trial_links(conn)
    build_category_stats(conn)
    build_subcategories(conn)  # <-- add this line
    build_global_stats(conn)
```

- [ ] **Step 3: Run the pipeline and verify**

```bash
cd /Users/ville/projects/cluster-headache-hub
python scripts/analyze-research.py --db data/research.db
```

Then verify the table:

```bash
sqlite3 data/research.db "SELECT category, COUNT(*), SUM(paper_count), SUM(trial_count) FROM rs_subcategories GROUP BY category ORDER BY COUNT(*) DESC"
```

Expected: rows for each category showing term counts.

Also spot-check pharmacology:

```bash
sqlite3 data/research.db "SELECT term, paper_count, trial_count FROM rs_subcategories WHERE category = 'pharmacology' ORDER BY paper_count DESC LIMIT 15"
```

Expected: Verapamil, Lithium, Melatonin, etc. with reasonable counts.

- [ ] **Step 4: Rebuild the frontend DB**

```bash
python scripts/build-analysis-db.py
```

Wait — `build-analysis-db.py` builds from JSON files, not from `research.db`. The research tables are in `research.db` which gets copied to `public/data.db` by the pipeline. Let me check the actual flow.

Actually, looking at the code more carefully: `analyze-research.py` writes directly to `research.db` (the `--db` parameter), and `update-all.py` copies that to `public/data.db`. So this step is just verifying the table exists in the output:

```bash
sqlite3 public/data.db "SELECT COUNT(*) FROM rs_subcategories"
```

If the table doesn't exist in `public/data.db`, check `update-all.py` for the copy step.

- [ ] **Step 5: Commit**

```bash
git add scripts/analyze-research.py
git commit -m "feat: add rs_subcategories table to research pipeline"
```

---

### Task 2: Add `getSubcategories` query to `data-db.tsx`

**Files:**
- Modify: `src/lib/data-db.tsx` (add type, query function, and expose via context)

- [ ] **Step 1: Add the `Subcategory` type**

Near the top of `src/lib/data-db.tsx`, after the `CategoryStats` interface (~line 105):

```typescript
export interface Subcategory {
  term: string
  paperCount: number
  trialCount: number
}
```

- [ ] **Step 2: Add `getSubcategories` to the context interface**

In `DataDbContextValue` (~line 133), add:

```typescript
  getSubcategories: (category: string) => Subcategory[]
```

- [ ] **Step 3: Implement `getSubcategories`**

After the `getCategoryStats` callback (~line 784), add:

```typescript
  const getSubcategories = useCallback(
    (category: string): Subcategory[] => {
      if (!db) return []
      try {
        const stmt = db.prepare(
          "SELECT term, paper_count, trial_count FROM rs_subcategories WHERE category = ? ORDER BY (paper_count + trial_count) DESC"
        )
        stmt.bind([category])
        const results: Subcategory[] = []
        while (stmt.step()) {
          const row = stmt.get()
          results.push({
            term: row[0] as string,
            paperCount: row[1] as number,
            trialCount: row[2] as number,
          })
        }
        stmt.free()
        return results
      } catch {
        return []
      }
    },
    [db],
  )
```

- [ ] **Step 4: Add to the context value object**

In the `value` object (~line 828), add `getSubcategories`:

```typescript
  const value: DataDbContextValue = {
    // ... existing fields ...
    getSubcategories,
  }
```

- [ ] **Step 5: Verify types**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data-db.tsx
git commit -m "feat: add getSubcategories query to DataDbProvider"
```

---

### Task 3: Add subcategory filter to `category.tsx`

**Files:**
- Modify: `src/pages/research/category.tsx` (add state, Select dropdown, filtering logic)

- [ ] **Step 1: Add imports and state**

At the top of `category.tsx`, add to the existing imports:

```typescript
import { useState } from "react"  // add useState to the existing import from "react"
```

Add the `Select` imports:

```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
```

Update the `useDataDb` destructure (~line 72) to include `getSubcategories`:

```typescript
  const { loading, getCategoryStats, searchPapers, searchTrials, getTrialAnalysis, getPaperAnalysis, getSubcategories } = useDataDb()
```

- [ ] **Step 2: Add subcategory data and filter state**

After the existing `useMemo` hooks (~line 87), add:

```typescript
  const subcategories = useMemo(() => {
    if (loading || !slug) return []
    return getSubcategories(slug)
  }, [loading, slug, getSubcategories])

  const [subcategoryFilter, setSubcategoryFilter] = useState<string | null>(null)
```

- [ ] **Step 3: Add filtered papers and trials**

Replace the existing `topPapers` and `categoryTrials` useMemo hooks with filtered versions:

```typescript
  const topPapers = useMemo(() => {
    if (loading || !slug) return []
    const papers = searchPapers({ category: slug, limit: 200 })
    if (!subcategoryFilter) return papers.slice(0, 15)
    return papers.filter((p) => {
      const searchIn = [
        p.title.toLowerCase(),
        ...p.meshTerms.map((t) => t.toLowerCase()),
        ...p.authorKeywords.map((t) => t.toLowerCase()),
      ].join(" ")
      return searchIn.includes(subcategoryFilter.toLowerCase())
    })
  }, [loading, slug, searchPapers, subcategoryFilter])

  const categoryTrials = useMemo(() => {
    if (loading || !slug) return []
    const trials = searchTrials({ category: slug })
    if (!subcategoryFilter) return trials
    return trials.filter((t) => {
      const searchIn = [
        t.title.toLowerCase(),
        ...t.interventions.map((i) => i.toLowerCase()),
      ].join(" ")
      return searchIn.includes(subcategoryFilter.toLowerCase())
    })
  }, [loading, slug, searchTrials, subcategoryFilter])
```

Note: we increase the paper limit to 200 so filtering has a larger pool, and only slice to 15 when showing "All".

- [ ] **Step 4: Render the Select dropdown**

In the JSX, between the header section and the stats cards section (~line 121, after the closing `</div>` of the header and before `{/* Stats */}`), add:

```tsx
      {/* Subcategory Filter */}
      {subcategories.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground">Filter by</span>
          <Select
            value={subcategoryFilter ?? "all"}
            onValueChange={(v) => setSubcategoryFilter(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="All treatments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All treatments</SelectItem>
              {subcategories.map((sc) => (
                <SelectItem key={sc.term} value={sc.term}>
                  {sc.term} ({sc.paperCount + sc.trialCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
```

- [ ] **Step 5: Add result count indicator**

Update the "Key Studies" heading to show filtered count. Replace the existing heading (~line 223):

```tsx
          <h3 className="mb-4 text-lg font-semibold">
            Key Studies
            {subcategoryFilter && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({topPapers.length} matching "{subcategoryFilter}")
              </span>
            )}
          </h3>
```

Do the same for the trials heading (~line 281):

```tsx
            <h3 className="mb-2 text-lg font-semibold">
              Clinical Trials
              {subcategoryFilter && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({categoryTrials.length} matching "{subcategoryFilter}")
                </span>
              )}
            </h3>
```

- [ ] **Step 6: Verify types and test in browser**

```bash
npx tsc --noEmit
```

Then open `http://localhost:5175/cluster-headache-hub/research/category/pharmacology` and verify:
1. Select dropdown appears with treatment options
2. Selecting "Verapamil" filters papers and trials to only verapamil-related items
3. Selecting "All treatments" resets the view
4. Stats cards and charts remain unfiltered
5. Categories with few subcategories (e.g., vitamin-d) hide the dropdown

- [ ] **Step 7: Commit**

```bash
git add src/pages/research/category.tsx
git commit -m "feat: add subcategory filter dropdown to category pages"
```

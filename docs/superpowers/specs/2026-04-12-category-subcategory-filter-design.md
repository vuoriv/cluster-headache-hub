# Category Page Subcategory Filter

## Problem

Category pages (e.g., `/research/category/pharmacology`) lump all papers and trials together. "Pharmacological Treatments" includes verapamil, lithium, triptans, melatonin, etc. — users can't drill down to a specific treatment within the category.

## Solution

Add a dropdown select on each category page that dynamically extracts treatment-specific subcategories from the data and filters the papers list and trials list.

## Design

### Data Extraction

Precalculated during the Python data pipeline (`build-analysis-db.py`) and stored in a new DB table `rs_subcategories`:

| Column | Type | Description |
|--------|------|-------------|
| category | TEXT | Parent category slug |
| term | TEXT | Normalized display label |
| paper_count | INTEGER | Papers matching this term |
| trial_count | INTEGER | Trials matching this term |

Pipeline steps:
1. For each category, scan all papers' MeSH terms + author keywords, and trials' intervention names
2. Normalize terms: lowercase, merge common aliases via a curated map (e.g., "lithium carbonate" → "Lithium")
3. Count paper and trial occurrences per normalized term
4. Store all terms (no minimum threshold — even a single important study should be visible)

Terms not in the alias map are title-cased as-is.

At render time, the category page simply queries `rs_subcategories` for the current category — no scanning or counting needed.

### UI

- **Component**: shadcn `Select` dropdown
- **Location**: Between category header/description and stats cards
- **Default value**: "All treatments" (no filter, current behavior)
- **Items**: Subcategory label + count in parentheses, e.g., "Verapamil (72)"
- **Sorted by**: Occurrence count descending

### Filtering Behavior

When a subcategory is selected:

- **Papers list ("Key Studies")**: Show only papers where the term appears in MeSH terms, author keywords, or title
- **Trials list ("Clinical Trials")**: Show only trials where the term appears in interventions or title
- **Stats cards, charts, study types, outcomes**: Remain unfiltered (describe full category)

Selecting "All treatments" resets to showing everything.

### Implementation

**Pipeline** (`build-analysis-db.py`):

1. Add subcategory extraction logic after existing category stats generation
2. Create `rs_subcategories` table
3. For each category, extract + normalize + count terms, insert rows

**Frontend** (`category.tsx` + `data-db.tsx`):

1. Add `getSubcategories(category)` query to `data-db.tsx` — reads from `rs_subcategories`
2. Add `subcategoryFilter` state (string | null) to `category.tsx`
3. Filter `topPapers` and `categoryTrials` client-side by matching selected term against MeSH terms, keywords, title, and interventions
4. Render Select dropdown between header and stats

### Data Flow

```
Pipeline: scan papers/trials → normalize → store in rs_subcategories
Category page: query rs_subcategories → populate Select dropdown
On selection: filter papers + trials client-side by term matching
Stats/charts: remain unfiltered (describe full category)
```

### Edge Cases

- Categories with few distinct treatments (e.g., oxygen, vitamin-d): dropdown simply has fewer options or is hidden if < 2 subcategories
- Papers/trials matching no subcategory: only visible when "All" is selected — acceptable since these are often tangential papers

# AI-Driven Subcategory Mapping

## Problem

Subcategory filtering relies on a manually maintained TERM_ALIASES map (~100 entries) that maps raw MeSH terms and keywords to canonical treatment names. This requires manual updates when new treatments, drug variants, or intervention names appear in the data. Cross-category contamination (e.g., verapamil appearing under psychedelic) was handled by heuristic primary-category assignment logic that also needed manual tuning (DEPRIORITIZED_CATS, TOPIC_TERMS, etc.).

## Solution

Replace the static TERM_ALIASES approach with AI-powered classification. The existing `llm-analyze.py` pipeline already processes each paper with an LLM — extend it to return structured intervention/topic data that `build_subcategories` uses directly. No manual term maps needed.

## Design

### Paper Analysis Prompt Changes

Update PAPER_PROMPT in `llm-analyze.py` to return:

```json
{
  "primary_interventions": ["Psilocybin"],
  "comparator_interventions": ["Placebo", "Verapamil"],
  "topics": ["chronobiology", "sleep"],
  "outcome": "showed_benefit",
  "plain_summary": "...",
  "key_finding": "...",
  "sample_size": 50,
  "study_type": "rct",
  "evidence_tier": 2
}
```

- `primary_interventions`: treatments/interventions the paper actually studies or evaluates. Use canonical names (e.g., "Psilocybin" not "psilocybin mushroom").
- `comparator_interventions`: treatments mentioned as controls, alternatives, or context. These do NOT count for subcategory assignment.
- `topics`: non-treatment research topics (epidemiology, quality of life, sleep, comorbidity, genetics, etc.). Relevant for observational/non-pharma categories.

The AI reads the abstract/full text and understands study design, so it can reliably distinguish between "this paper studies psilocybin" vs "this paper mentions psilocybin as background".

### Trial Analysis

Trial interventions from `tr_trials.interventions` are inherently primary (they're what the trial is testing). The existing `tr_analyses.what_tested` provides additional context. No prompt changes needed for trials — just normalize intervention names via the AI-generated term map.

For trial intervention normalization: build a canonical name lookup from all `primary_interventions` across papers. If a trial intervention matches (case-insensitive) any canonical name or any raw term that maps to one, use that canonical name.

### pa_analyses Schema

Add columns to the AI analysis path (already has `interventions_studied`):

- Rename/repurpose `interventions_studied` → store `primary_interventions` JSON
- Add `comparator_interventions` TEXT (JSON array)
- Add `topics` TEXT (JSON array)

The regex analysis path doesn't populate these — that's fine since we run AI on all papers.

### build_subcategories Changes

Replace TERM_ALIASES/SKIP_TERMS/TOPIC_TERMS approach entirely:

1. Read `primary_interventions` and `topics` from `pa_analyses` for each paper
2. For each category, count how many papers have each canonical term as a primary intervention or topic
3. For trials: normalize intervention names against the canonical names from paper analyses
4. Primary category assignment: term belongs to category where it appears as primary most often. No DEPRIORITIZED_CATS needed — AI distinguishes primary vs comparator at paper level
5. `search_terms`: collect all raw MeSH terms + author keywords from papers where the AI identified a given canonical term as primary. Store as JSON for frontend matching.

### Error Handling

**Retry logic**: if LLM call fails, retry once after 2s delay. If still fails, store in `rs_analysis_errors` table:

| Column | Type |
|--------|------|
| id | TEXT (pmid or nct_id) |
| error | TEXT |
| timestamp | TEXT |
| retry_count | INTEGER |

Errors are retried on next weekly run. Pipeline summary prints count of failed analyses.

**Format validation**: if AI returns JSON but with missing/wrong fields, fill defaults and log warning. Don't silently skip.

### Pipeline Flow

```
llm-analyze.py (per paper):
  → returns primary_interventions, comparator_interventions, topics
  → stored in pa_analyses

build_subcategories (aggregate):
  → reads pa_analyses.primary_interventions + topics
  → counts per category
  → assigns primary category (highest count)
  → builds search_terms from raw MeSH/keywords
  → stores in rs_subcategories
```

### What Gets Removed

- `TERM_ALIASES` dict (~100 entries)
- `SKIP_TERMS` set
- `TOPIC_TERMS` set
- `TOPIC_CATS` set
- `DEPRIORITIZED_CATS` set
- `reverse_aliases` logic
- All the manual normalization code in `build_subcategories`

### Migration

1. Update PAPER_PROMPT to include `primary_interventions`, `comparator_interventions`, `topics`
2. Update `pa_analyses` schema to store new fields
3. Run full AI analysis on all ~4400 papers (one-time)
4. Update `build_subcategories` to use AI data
5. Remove static term maps
6. Weekly runs process only new papers

### Costs

- One-time full run: ~4400 papers x 1 API call each = ~4400 calls to Cerebras
- Weekly: only new papers (~10-30 per week)
- Cerebras/Qwen3 pricing is very low (~$0.10/M tokens), so full run is ~$1-2

### Frontend Impact

None. `rs_subcategories` table schema stays the same (category, term, paper_count, trial_count, search_terms). Frontend code is unchanged.

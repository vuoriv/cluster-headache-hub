# Front Page + Database Merge Design

**Date:** 2026-04-04
**Status:** Working independently per user request

## Summary

1. Merge `analysis.db` + `research.db` into a single `data.db`
2. Build a compelling front page at `/` describing the project
3. Navigation: front page → 3 sections (ClusterBusters, Research, Trials)
4. Research Search defaults to top-relevance papers

## Database Merge

### Approach
- Pipeline script merges both databases into `public/data.db`
- Single `DataDbProvider` replaces both `AnalysisDbProvider` and `ResearchDbProvider`
- All existing queries preserved, same interface
- `analysis.db` tables copied into combined database alongside research tables

### Combined Schema
**From analysis.db:** forum_stats, treatment_rankings, timeline, outcomes, co_occurrence, treatment_profiles, recommendation_data
**From research.db:** trials, papers, pipeline_meta

### Provider API
```typescript
interface DataDbContextValue {
  loading: boolean
  error: string | null
  // Forum analysis (from analysis.db)
  getForumStats(): ForumStats | null
  getTreatmentRankings(): TreatmentRanking[]
  getTimeline(): TimelineData | null
  getOutcomes(): OutcomesMap
  getOutcomeByName(name: string): OutcomeData | null
  getCoOccurrence(): CoOccurrenceMap
  getTreatmentProfile(slug: string): TreatmentProfile | null
  getRecommendationData(): RecommendationData | null
  // Research (from research.db)
  searchPapers(params): ResearchPaper[]
  searchTrials(params): ResearchTrial[]
  getActiveTrials(): ResearchTrial[]
  getTrial(nctId: string): ResearchTrial | null
  getPaper(pmid: string): ResearchPaper | null
  getMeta(): PipelineMeta | null
  getCategories(): string[]
}
```

## Front Page Design

### Layout (top to bottom)

1. **Hero Section** (full-width, gradient background)
   - Title: "Cluster Headache Research Hub"
   - Tagline: "The most painful condition known to medicine — explored through data, research, and patient experience."
   - Brief 2-sentence description of what this platform does
   - Subtle brain/medical iconography

2. **Live Stats Bar**
   - 4 key metrics from the database: Active Trials | Research Papers | Psychedelic Studies | Forum Posts Analyzed
   - Animated count-up on load
   - Links to respective sections

3. **Three Section Cards** (grid, equal height)
   - **ClusterBusters** — "40,000+ forum posts analyzed with NLP to extract what actually works for patients"
   - **Research Search** — "3,500+ peer-reviewed papers from PubMed, categorized and scored for relevance"
   - **Active Trials** — "Currently recruiting clinical trials with category badges and progress tracking"
   - Each card has: icon, title, description, key stat, CTA button

4. **Patient Perspective Banner**
   - Highlights the treatment gap: many standard treatments fail, community knowledge fills the gap
   - Links to ClusterBusters section for the evidence

5. **Data Sources Footer Note**
   - ClinicalTrials.gov, PubMed, ClusterBusters.org forum

### Visual Style
- Uses existing design system: oklch colors, DM Sans/DM Serif Display fonts
- Cards with hover effects, subtle shadows
- Dark/light mode fully supported
- Responsive: single column on mobile, 3-col grid on desktop

## Routing Update

| Route | Component | Notes |
|-------|-----------|-------|
| `/` | FrontPage | New landing page |
| `/clusterbusters/*` | ClusterBusters | Lazy-loaded, unchanged |
| `/research` | ResearchSearch | Default shows top papers |
| `/trials` | ActiveTrials | Unchanged |

## Research Search Default

When no search query is entered, show the top 25 papers sorted by `relevance_score DESC` instead of an empty state.

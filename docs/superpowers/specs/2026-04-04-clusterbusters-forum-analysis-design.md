# ClusterBusters Forum Analysis — Design Spec

**Date**: 2026-04-04
**Status**: Approved
**Scope**: Data analysis pipeline + interactive web dashboard for ClusterBusters forum data

---

## 1. Overview

Add a new "ClusterBusters" tab to the Cluster Headache Research Hub that presents an interactive analysis of 17 years of patient forum data from ClusterBusters.org — the largest online cluster headache patient community.

**Goals:**
- Deep-dive analysis of treatment discussions, protocols, dosing, outcomes, and evolution over time
- Rank treatments by community-reported effectiveness using NLP
- Interactive dashboard with charts, comparison tools, and a recommendation explorer
- Full transparency on methodology and limitations
- Anonymous — no usernames or identifying information

**Non-goals:**
- Real-time forum data (static snapshot)
- Clinical/medical claims (community-reported data only)
- i18n for ClusterBusters content (English-only for now, translations added later)

---

## 2. Data Source

- **Database**: `~/projects/clusterbusters/clusterbusters.db` (251MB SQLite, WAL mode)
- **Content**: 40,388 posts across 7,869 topics, spanning Oct 2009 – Apr 2026
- **Forums**: 6 active sections — Share Your Busting Stories (48% of posts), Theory & Implementation (29%), General Board, Research & Scientific News, Advocacy, ClusterBuster Files
- **Schema**: `forums`, `topics`, `posts` (with `content_text`, `content_html`, author metadata, dates, likes), `scrape_progress`

**Data quality issues to address:**
- All posts have reaction buttons appended to `content_text`: `Thanks|Haha|Confused|Sad|Like|×|Quote`
- ~282 posts contain raw HTML tags in `content_text`
- `author_rank` field is corrupted (contains timestamps, not roles)
- 8.4% of posts are under 100 characters (noise)

---

## 3. Architecture

### 3.1 Approach: Pre-computed Static JSON

Single Python analysis script reads SQLite → processes through 4 stages → outputs JSON files to `src/data/` → Vite bundles them as static imports. No runtime DB access, no backend needed. Fits GitHub Pages deployment.

### 3.2 Pipeline Stages

```
clusterbusters.db → Stage 1 → Stage 2 → Stage 3 → Stage 4 → src/data/*.json
                     Clean      Extract    Sentiment   LLM
                     text       treatments  & outcome   deep dive
```

**Stage 1: Text Preprocessing**
- Strip reaction button pattern: `\s*(Thanks|Haha|Confused|Sad|Like|×|Quote)\s*`
- Remove HTML artifacts from `content_text`
- Normalize whitespace, fix encoding issues
- Filter posts <50 characters (noise)
- Anonymize: strip any real names, emails, or identifying info
- Output: cleaned posts in memory for subsequent stages

**Stage 2: Treatment Extraction (all 40K posts)**
- Regex patterns for each treatment family:
  - Mushrooms/psilocybin: `mushroom|shroom|psilocybin|cubensis`
  - RC seeds/LSA: `rc seed|rivea|hbwr|hawaiian baby woodrose|lsa|morning glory`
  - Oxygen: `oxygen|o2|high.?flow|welding`
  - LSD: `\blsd\b|lysergic|\bacid\b` (word boundary on "acid" to avoid "stomach acid" false positives)
  - Vitamin D3: `vitamin d|d3|d3 regimen|anti-inflammatory regimen`
  - Verapamil: `verapamil|calan|isoptin`
  - Triptans: `sumatriptan|imitrex|zomig|triptan|rizatriptan|maxalt`
  - Ketamine: `ketamine|k-therapy`
  - BOL-148: `bol-148|bol.?148|bromo.?lsd`
  - Melatonin: `melatonin`
  - Prednisone: `prednisone|pred|steroid|methylprednisolone`
  - Lithium: `lithium`
  - Energy drinks (abort): `red bull|energy drink|caffeine|taurine`
  - (additional treatments discovered by frequency analysis)
- Track per-post: which treatments mentioned, post date, forum
- Build: co-occurrence matrix, per-year frequency, per-forum distribution
- Output: `treatment-rankings.json`, `timeline.json`, `co-occurrence.json`

**Stage 3: Sentiment & Outcome Analysis (all 40K posts)**
- Domain-specific lexicon:
  - Positive: pain-free, busted, shadow-free, remission, worked, amazing, gone, relief, abort, stopped, broke the cycle, PF (pain free), kip 0
  - Negative: failed, rebound, no effect, worse, useless, didn't work, no relief, nothing, waste
  - Partial: some relief, reduced, partial, less intense, not sure, kinda, helped a bit
- Score each treatment-mentioning post as positive/negative/partial/neutral
- Aggregate: success rate per treatment, sentiment trend over time
- Output: `outcomes.json`, `sentiment-by-treatment.json`

**Stage 4: LLM Deep Extraction (top treatments only)**
- Select top N treatments by: `(normalized_mention_count * 0.4) + (positive_rate * 0.6)` — both values normalized to 0-1 range (mention count divided by max mention count), weighted toward effectiveness

- For each top treatment: sample ~200-500 highest-signal posts (longest, most liked, from "Busting Stories" and "Theory & Implementation" forums)
- Claude API (Haiku for cost efficiency) batch extraction per post:
  - Dosage: amount, form (dried, tea, capsules), preparation method
  - Protocol: timing, frequency, taper requirements (5-day rule etc.)
  - Outcome: 1-5 scale (1=no effect, 5=complete remission) + description
  - Side effects: listed
  - Co-treatments: what else was used alongside
  - Time to effect: how quickly it worked
  - CH type context: episodic vs chronic, in-cycle vs preventive
- Aggregate into treatment profiles with statistical summaries
- Output: `treatments/{slug}.json` per treatment

### 3.3 Output JSON Files

```
src/data/
├── forum-stats.json            # Total posts, topics, date range, forum breakdown
├── treatment-rankings.json     # All treatments ranked by mentions + success rate
├── timeline.json               # Monthly/yearly mention counts per treatment
├── co-occurrence.json          # Treatment co-mention matrix
├── outcomes.json               # Success/partial/fail rates per treatment
├── recommendation-data.json    # Filter dimensions + treatment-situation mappings
└── treatments/
    ├── mushrooms.json          # Deep dive profile
    ├── oxygen.json
    ├── rc-seeds.json
    ├── lsd.json
    ├── vitamin-d3.json
    ├── verapamil.json
    ├── triptans.json
    └── ... (data-determined)
```

`recommendation-data.json` contains:
```typescript
{
  filters: {
    chTypes: ["episodic", "chronic"]
    cycleStatus: ["in-cycle", "remission", "new-patient"]
    treatmentsTried: string[]  // slugs of all treatments
  }
  patterns: {
    situation: { chType: string, cycleStatus: string, triedSlugs: string[] }
    suggested: { slug: string, reason: string, successRate: number }[]
  }[]
}
```

Each `treatments/{slug}.json` contains:
```typescript
{
  slug: string
  name: string
  category: "psychedelic" | "conventional" | "supportive" | "acute"
  stats: { mentions: number, positiveRate: number, peakYear: number, commonDose: string }
  protocol: { preparation: string[], dosing: string[], schedule: string[] }
  outcomes: { effective: number, partial: number, noEffect: number, sampleSize: number }
  timeline: { year: number, mentions: number, positiveRate: number }[]
  sideEffects: string[]
  contraindications: string[]
  coTreatments: { name: string, frequency: number }[]
  timeToEffect: { description: string, distribution: Record<string, number> }
}
```

---

## 4. Frontend Design

### 4.1 Navigation

**New tab**: "ClusterBusters" added as 7th tab in the main tab bar.

**Routing**: Nested hash routes within the tab:
- `#clusterbusters` — Landing dashboard
- `#clusterbusters/{slug}` — Treatment deep dive (e.g., `#clusterbusters/mushrooms`)
- `#clusterbusters/compare` — Side-by-side comparison tool
- `#clusterbusters/methodology` — How we analyzed the data

**Sub-navigation**: Breadcrumb + card navigation pattern. Landing page shows clickable treatment cards; clicking opens deep dive with breadcrumb trail (`ClusterBusters > Mushrooms`). Back button returns to landing.

**Hash routing implementation**: Extend existing `App.tsx` hash routing. When `activeTab === "clusterbusters"`, render `ClusterBustersTab` which internally parses the hash for subpath routing.

### 4.2 Language

English-only for all ClusterBusters content. No i18n keys — hardcoded English strings. The tab name "ClusterBusters" in the main tab bar is also not translated (it's a proper noun). Translations will be added later as a separate task.

### 4.3 Page: Landing Dashboard (`#clusterbusters`)

**Sections in order:**

1. **Intro description** — Short paragraph explaining what ClusterBusters is, what data we're showing, and why it matters. Sets context for first-time visitors.

2. **Disclaimer banner** — `Alert` component (warning variant). "Community-reported experiences from ClusterBusters.org forums (2009–2026). Not medical advice." Links to methodology page.

3. **Hero stats row** — 4 stat cards in a grid: Total Posts (40,388), Topics (7,869), Years of Data (17), Success Ratio (5.2:1). Uses existing stat card pattern from Header component.

4. **Treatment Rankings** — Horizontal `BarChart` (shadcn Chart). Treatments ranked by community-reported success rate. Color-coded: psychedelic (purple), conventional (muted), supportive (blue), acute (green). Clicking a bar navigates to deep dive.

5. **Treatment Discussion Over Time** — Stacked `AreaChart` (shadcn Chart). Shows how treatment mentions evolved 2009–2026. Each treatment is a stacked area. Interactive tooltip shows counts per treatment per year.

6. **Explore Treatments** — Grid of `Card` components, one per treatment. Shows name, mention count, positive rate. Clicking navigates to `#clusterbusters/{slug}`. Cards color-coded by category.

7. **Find What Works (Recommendation Tool)** — Filter section with `Select` dropdowns: CH type (episodic/chronic), cycle status (in cycle/remission/new), treatments tried. Results area shows matching treatment patterns from forum data with links to compare and deep dive.

### 4.4 Page: Treatment Deep Dive (`#clusterbusters/{slug}`)

**Layout:**

1. **Breadcrumb** — `← ClusterBusters / {Treatment Name}` + category `Badge`

2. **Stats row** — 4 stat cards: Mentions, Positive Outcome %, Peak Year, Common Dose

3. **Two-column layout** (stacks on mobile):
   - **Left: Community Protocol Guide** — `Card` with sections: Preparation, Dosing, Schedule. Content from LLM-extracted protocol data. Each section in a styled block.
   - **Right: Charts** — Outcome Distribution (`PieChart` donut showing effective/partial/no-effect), Mentions Over Time (`AreaChart`)

4. **Bottom row** — 3 `Card` components side by side:
   - Side Effects (warning color)
   - Contraindications (danger color)
   - Often Combined With (info color, links to other treatment pages)

### 4.5 Page: Comparison Tool (`#clusterbusters/compare`)

1. **Treatment selector** — `Badge` chips for selected treatments (max 3) with remove button. `Select` dropdown or `Command` to add treatments.

2. **Radar chart** — `RadarChart` (shadcn Chart) comparing selected treatments across dimensions: success rate, mention volume, side effect severity, accessibility, time to effect.

3. **Comparison table** — `Table` component with treatments as columns, metrics as rows: success rate, type (acute/preventive), mentions, side effects, common dose, co-treatments.

### 4.6 Page: Methodology (`#clusterbusters/methodology`)

Content-focused page with `Card` sections:

1. **Data Source** — What ClusterBusters is, what we scraped, date range, volume
2. **Analysis Pipeline** — Visual 4-step pipeline (numbered cards): Text Cleanup → Treatment Extraction → Sentiment Analysis → LLM Extraction. Each step explained.
3. **Treatment Selection** — How we chose which treatments to deep-dive (formula: mention frequency × outcome positivity)
4. **NLP Approach** — Domain-specific lexicon details, how sentiment is scored, what LLM extraction prompts look like
5. **Limitations & Biases** — Selection bias (successful users stay engaged), self-report (not clinically verified), temporal bias (peak 2010-2012), variable sample sizes per treatment
6. **Open Source** — All analysis scripts available. All data anonymized.

### 4.7 Chart Components (shadcn Chart / Recharts)

All charts use `ChartContainer` + `ChartConfig` + `ChartTooltip` + `ChartLegend` from shadcn:

| Chart | Type | Where Used |
|-------|------|------------|
| Treatment Rankings | `BarChart` (horizontal) | Landing |
| Timeline | `AreaChart` (stacked, interactive) | Landing + Deep Dive |
| Outcome Distribution | `PieChart` (donut) | Deep Dive |
| Sentiment Trend | `LineChart` | Deep Dive (optional) |
| Multi-Treatment Comparison | `RadarChart` | Compare page |
| Treatment Score | `RadialBarChart` | Treatment cards (optional) |

Colors via CSS variables: `--chart-1` through `--chart-N` defined in `index.css`, referenced in `ChartConfig`.

### 4.8 Component Structure

```
src/components/tabs/
├── clusterbusters-tab.tsx          # Router: parses hash, renders subpage
├── clusterbusters/
│   ├── cb-landing.tsx              # Landing dashboard
│   ├── cb-treatment-detail.tsx     # Treatment deep dive
│   ├── cb-compare.tsx              # Comparison tool
│   ├── cb-methodology.tsx          # How we analyzed
│   ├── cb-treatment-card.tsx       # Card for treatment grid
│   ├── cb-stats-row.tsx            # Reusable stats row
│   ├── cb-treatment-rankings.tsx   # Bar chart component
│   ├── cb-timeline-chart.tsx       # Area chart component
│   ├── cb-outcome-chart.tsx        # Pie chart component
│   ├── cb-radar-chart.tsx          # Radar chart component
│   ├── cb-recommendation.tsx       # Filter + results
│   └── cb-disclaimer.tsx           # Warning banner
```

All components follow existing project patterns:
- Named exports
- shadcn/ui components (Card, Badge, Alert, Select, Table, Separator, Skeleton)
- shadcn Chart for all visualizations
- Tailwind v4 with semantic colors (`bg-primary`, `text-muted-foreground`)
- `cn()` for conditional classes
- `gap-*` not `space-*`
- Lucide icons via `data-icon`

---

## 5. Data Pipeline Script

### 5.1 Location & Execution

```
scripts/
└── analyze-forum.py    # Single Python script, run manually
```

Run: `python scripts/analyze-forum.py --db ~/projects/clusterbusters/clusterbusters.db --output src/data/`

Optional flags:
- `--skip-llm` — Skip Stage 4 (LLM extraction), useful for development
- `--llm-model haiku` — Claude model to use (default: haiku for cost)
- `--top-n 10` — Number of treatments to deep-dive with LLM
- `--sample-size 300` — Posts per treatment for LLM extraction

### 5.2 Dependencies

```
pip install anthropic   # Claude API for Stage 4
# sqlite3 is stdlib
# re, json, collections, statistics are stdlib
```

No heavy NLP libraries (spaCy, NLTK) — domain-specific regex + lexicon is more accurate for this corpus than generic NLP.

### 5.3 Anonymization

- Never include usernames, author IDs, or `author_rank` in output JSON
- Strip any emails or real names detected in post content
- Aggregate data only — no individual post content in output
- Protocol descriptions are synthesized from patterns, not quoted verbatim

---

## 6. New shadcn Components Needed

Install via CLI before implementation:
```bash
npx shadcn@latest add chart        # Recharts wrapper (ChartContainer, ChartConfig, etc.)
npx shadcn@latest add breadcrumb   # For subpage navigation
```

Already installed: alert, badge, button, card, dialog, input, scroll-area, select, separator, skeleton, table, tabs, tooltip

---

## 7. Integration Points

### 7.1 App.tsx Changes

- Add "ClusterBusters" to `validTabs` array
- Add `TabsTrigger` and `TabsContent` for the new tab
- `ClusterBustersTab` component handles internal sub-routing by parsing `window.location.hash` beyond `#clusterbusters`

### 7.2 Header Changes

- No changes needed — ClusterBusters stats are self-contained in the tab, not in the global header

### 7.3 Static Data Imports

```typescript
// src/data/ files imported as:
import forumStats from "@/data/forum-stats.json"
import treatmentRankings from "@/data/treatment-rankings.json"
import timeline from "@/data/timeline.json"
// etc.
```

TypeScript types for all JSON structures defined in `src/lib/clusterbusters-types.ts`.

---

## 8. Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data pipeline approach | Pre-computed static JSON (Option A) | DB is a fixed snapshot; GitHub Pages = static only |
| Navigation | Breadcrumb + card nav (Option C) | Scales well, content-focused, no sidebar clutter |
| Sub-navigation | Hash-based nested routes | Extends existing pattern, no router library needed |
| NLP approach | Regex + lexicon + LLM for top treatments | Domain-specific lexicon > generic NLP; LLM for structured extraction where it matters |
| Treatment selection | Data-driven (mention count × outcome positivity) | No editorial bias — let the community data decide |
| Charts | shadcn Chart (Recharts) | Matches project's shadcn/ui stack, composable |
| Language | English-only, translations later | Hardcoded strings for now, i18n added as separate task |
| Disclaimers | Persistent subtle banner (Option A) | Honest without patronizing experienced patients |
| Anonymization | Strip all user identifiers | Ethical requirement — community data, not individual exposure |
| Methodology page | Included | Transparency builds trust for medical community site |

# Cluster Headache Research Hub

A data-driven research platform for cluster headache patients, combining clinical evidence, community intelligence, and patient support resources.

**Live site**: [vuoriv.github.io/cluster-headache-hub](https://vuoriv.github.io/cluster-headache-hub/)

## What It Does

- **Research** — 4,400+ papers from PubMed and 100+ clinical trials from ClinicalTrials.gov, categorized, scored, and searchable. AI-powered analysis classifies each paper's study type, outcome, and primary interventions.
- **ClusterBusters Forum Analysis** — 40,000+ forum posts analyzed with NLP to extract treatment outcomes, sentiment, and patterns across 16 years of community data.
- **Community Groups** — Directory of 50+ patient support organizations worldwide.
- **Subcategory Filtering** — Drill into specific treatments within broad categories (e.g., filter "Pharmacological Treatments" to just Verapamil or Lithium studies).
- **Pipeline Diagnostics** — Hidden `/diagnostics` page showing pipeline run history, AI analysis coverage, and error tracking.

## Architecture

```
Weekly Python Pipeline          Static React Frontend
(GitHub Actions)                (GitHub Pages)

fetch-research.py               Browser loads data.db via sql.js (WASM)
  ↓ PubMed + ClinicalTrials.gov
analyze-research.py             DataDbProvider → synchronous SQL queries
  ↓ regex classification
llm-analyze.py                  React pages render from query results
  ↓ LLM AI analysis
build-analysis-db.py            No server — entirely client-side
  ↓ forum/community JSON → SQL
public/data.db ─────────────→  fetched by browser at page load
```

Zero backend. Everything is pre-computed in the pipeline and shipped as a single SQLite file.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 7 |
| Styling | Tailwind CSS v4, shadcn/ui (radix-nova) |
| Data | sql.js (SQLite in WASM), Recharts |
| Fonts | DM Sans Variable, DM Serif Display |
| Icons | Lucide React |
| Pipeline | Python 3.11, sqlite3, requests |
| AI | OpenAI-compatible LLM API for paper/trial analysis |
| Deploy | GitHub Pages via GitHub Actions |

## Development

```bash
# Frontend
npm install
npm run dev          # http://localhost:5173/cluster-headache-hub/

# Type check, lint, format
npm run typecheck
npm run lint
npm run format

# Pipeline (requires Python 3.11+)
pip install requests
python scripts/update-all.py --skip-fetch   # Analyze existing data
```

## Data Pipeline

The pipeline runs weekly via GitHub Actions (`weekly-update.yml`) and can be triggered manually:

1. **Fetch** — PubMed E-utilities API + ClinicalTrials.gov API
2. **Classify** — Regex-based study type and outcome classification
3. **AI Analysis** — LLM classifies primary interventions, comparators, and topics per paper
4. **Forum/Community** — Rebuilds ClusterBusters forum analysis and community group tables from JSON
5. **Subcategories** — Builds treatment subcategory index from AI classifications

All output goes into `public/data.db`. Pipeline run metadata and logs are stored in `rs_pipeline_runs` table, visible on the `/diagnostics` page.

## Project Structure

```
src/
  pages/              Page components
  components/
    layout/           Header, Layout
    tabs/             Feature sub-components (ClusterBusters, etc.)
    ui/               shadcn/ui components
  lib/                Data provider, types, utilities
scripts/              Python pipeline scripts
public/               Static assets + data.db + sql-wasm.wasm
.github/workflows/    CI/CD (deploy + weekly update)
docs/superpowers/     Design specs and implementation plans
```

## License

This project is for educational and research purposes. Not medical advice.

# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

**Cluster Headache Research Hub** — a static data-driven research platform combining clinical evidence (PubMed, ClinicalTrials.gov), community intelligence (ClusterBusters forum analysis), and a global patient group directory. Zero backend — all data served from a pre-built SQLite database via sql.js (WASM) in the browser.

**Deployed at**: GitHub Pages via `deploy.yml` on push to `main`
**Data updated**: Weekly via `weekly-update.yml` (Python pipeline → commits `public/data.db` → triggers deploy)

## Architecture

```
Python pipeline (scripts/)          React frontend (src/)
  fetch-research.py                   App.tsx → BrowserRouter
  analyze-research.py                 DataDbProvider → sql.js WASM
  llm-analyze.py (Cerebras/Qwen3)    useDataDb() → synchronous SQL
  build-analysis-db.py                Pages render from DB queries
       ↓
  public/data.db (SQLite)  ←──────  fetched at runtime by browser
```

All data lives in `public/data.db`. The research pipeline writes directly to it. Forum analysis reads from a separate source DB passed via `--forum-db`.

## Tech Stack

**Frontend**: React 19 | TypeScript (strict) | Vite 7 | Tailwind CSS v4 | shadcn/ui (radix-nova) | Recharts | sql.js | React Router 7 | Lucide icons
**Pipeline**: Python 3.11 | sqlite3 | requests | Cerebras API (Qwen3)
**Fonts**: DM Sans Variable (body) | DM Serif Display (headings)
**Deploy**: GitHub Pages via GitHub Actions

## Essential Commands

```bash
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run format       # Prettier

# Pipeline (requires Python 3.11+)
python scripts/update-all.py                     # Full update
python scripts/update-all.py --skip-fetch        # Analysis only
python scripts/llm-analyze.py                    # AI analysis (needs CEREBRAS_API_KEY)
python scripts/analyze-research.py --only-subcategories  # Rebuild subcategories
```

## Component Conventions

- **Named exports only**: `export function FooPage()` — no `export default` except `App.tsx` and lazy-loaded route entry points (`clusterbusters.tsx`, `research-page.tsx`)
- **Helper components**: plain `function` at bottom of file, never exported
- **Props**: typed inline `{ foo }: { foo: string }` or named `interface FooProps` above the function
- **No class components** (except the existing `ErrorBoundary`)

## Data Access Pattern

All data access goes through `DataDbProvider` context:

```tsx
const { loading, getForumStats } = useDataDb()
const data = useMemo(() => (loading ? null : getForumStats()), [loading, getForumStats])
```

Rules:
- Always call `useDataDb()` — never import DB functions directly
- Always guard on `loading` before calling any getter
- Always wrap in `useMemo` with `[loading, getter]` dependencies
- Return `[]` for arrays, `null` for objects, `{}` for maps when loading/empty

## Loading & Error States

- Use `<Skeleton>` from `@/components/ui/skeleton` during loading
- Pattern: `Array.from({ length: N }).map((_, i) => <Skeleton key={i} className="..." />)`
- Error: `<div className="... text-destructive">` with message

## Styling Rules

- **Tailwind v4 only** — no CSS modules, no inline styles (except chart `style={{ height }}`)
- **`cn()`** from `@/lib/utils` for all conditional class merging
- **Semantic tokens**: `bg-primary`, `text-muted-foreground` — never arbitrary colors
- **Colors**: `oklch()` color space — no HSL or hex
- **Icon sizes**: `className="size-4"` — never `w-4 h-4`
- **Stat numbers**: add `tabular-nums tracking-tight`
- **Stat labels**: `text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground`
- **Accent icon boxes**: `bg-{color}-50 text-{color}-500 dark:bg-{color}-950/40 dark:text-{color}-400`

## TypeScript Rules

- `import type { Foo }` for type-only imports (required by `verbatimModuleSyntax`)
- `interface` or `type` only — no enums (`erasableSyntaxOnly`)
- No `any` — use `unknown` then narrow
- `as const` for lookup tables (REGIONS, PLATFORMS, CATEGORIES, etc.)

## Charts (Recharts + shadcn)

- Define `ChartConfig` as module-level `const` with `label` and `color` fields
- Colors: `oklch(...)` or `var(--chart-N)` CSS variables
- Always wrap in `<ChartContainer config={...}>` — never bare Recharts
- Always include `<ChartTooltip content={<ChartTooltipContent />} />`

## Python Pipeline Rules

- Path setup: `SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))` + `PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)`
- All paths from these constants — never relative
- Direct `sqlite3` — no ORM, explicit `sqlite3.connect()` / `conn.commit()` / `conn.close()` — do not use `with sqlite3.connect()` auto-close pattern
- `ALTER TABLE ADD COLUMN` wrapped in try/except for idempotency
- Print progress with `flush=True`
- `sys.exit(1)` on fatal errors
- DB table prefixes: `cb_` (forum) | `pa_` (papers) | `tr_` (trials) | `rs_` (research/pipeline stats) | `co_` (community)

## File Organization

```
src/pages/                    # Page components (flat or nested by section)
src/pages/research/           # Research sub-pages
src/pages/insights/           # Insight detail pages
src/components/layout/        # Header, Layout
src/components/tabs/{feature}/ # Feature sub-components (cb-landing.tsx, cb-compare.tsx)
src/components/ui/            # shadcn components — don't modify for feature logic
src/components/               # Shared components (error-boundary, theme-provider)
src/lib/                      # Types, utilities, data provider
scripts/                      # Python pipeline scripts
public/                       # Static assets + data.db + sql-wasm.wasm
.github/workflows/            # CI/CD
docs/superpowers/             # Design specs and implementation plans
```

## Formatting (Prettier)

- No semicolons | Double quotes | 2-space indent | 80 char width
- Trailing commas (ES5) | LF line endings
- Tailwind class sorting via `prettier-plugin-tailwindcss`

## What NOT to Do

- Don't add state management libraries (Redux, Zustand) — `DataDbProvider` covers all data
- Don't add comments unless specifically requested
- Don't use HSL/hex colors — use `oklch()` or CSS variable tokens
- Don't import `@radix-ui/*` directly — use shadcn wrappers
- Don't create new context providers — extend `DataDbProvider` if needed. Note: `TooltipProvider` wraps the app in `App.tsx` — tooltips work without additional setup
- Don't use `useEffect` to compute derived data — always `useMemo`
- Don't modify `src/components/ui/` for feature-specific behavior
- Don't commit without explicit user approval

## Git Conventions

- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- Pipeline auto-commits: `chore: weekly data update YYYY-MM-DD`
- Never force-push to `main`

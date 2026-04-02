# Visual Redesign — "Calm Authority"

**Goal:** Elevate the Cluster Headache Research Hub from 5.5/10 to 8+/10 visual quality. Replace generic shadcn defaults with a distinctive, warm, medically trustworthy design that feels intentionally crafted for CH patients.

**Direction:** Calm authority — medical trustworthiness with human warmth. Not clinical coldness, not startup energy.

**Tech:** React + Vite + Tailwind v4 + shadcn/ui (radix-nova). All changes within existing stack.

---

## 1. Typography

**Replace Geist with DM Sans + DM Serif Display.**

- `--font-sans`: DM Sans (body, UI, badges, metadata)
- `--font-heading`: DM Serif Display (h1, h2, CardTitle for top-level cards)
- Install via `@fontsource-variable/dm-sans` and `@fontsource/dm-serif-display`
- Remove `@fontsource-variable/geist`

**Hierarchy scale:**
| Element | Size | Weight | Font |
|---------|------|--------|------|
| Hero h1 | 2.25rem (36px) | 700 | DM Serif Display |
| Tab page h2 | 1.5rem (24px) | 700 | DM Serif Display |
| Section h3 | 1.125rem (18px) | 600 | DM Sans |
| CardTitle | 0.9375rem (15px) | 600 | DM Sans |
| Body text | 0.875rem (14px) | 400 | DM Sans |
| Metadata/labels | 0.75rem (12px) | 500 | DM Sans |

**File changes:** `src/index.css` (font imports, `--font-heading`, `--font-sans`), `package.json` (swap font deps)

## 2. Color Palette

**Light theme — warm slate-blue with gold accent:**
```
--background: oklch(0.98 0.005 230)      /* warm off-white */
--foreground: oklch(0.15 0.025 235)      /* deep slate */
--primary: oklch(0.30 0.08 235)          /* rich navy-blue */
--primary-foreground: oklch(0.97 0.005 230)
--accent: oklch(0.92 0.04 75)            /* warm gold tint */
--accent-foreground: oklch(0.30 0.08 235)
--muted: oklch(0.96 0.008 230)
--muted-foreground: oklch(0.45 0.02 235)
--ring: oklch(0.50 0.08 235)
--border: oklch(0.90 0.01 230)
```

**Dark theme — rich slate with warm undertones:**
```
--background: oklch(0.14 0.018 235)
--foreground: oklch(0.94 0.008 225)
--primary: oklch(0.80 0.06 225)
--primary-foreground: oklch(0.15 0.025 235)
--accent: oklch(0.30 0.04 75)
--accent-foreground: oklch(0.94 0.008 225)
--card: oklch(0.18 0.02 235)
--ring: oklch(0.50 0.06 225)
```

**Key difference from current:** accent is now visibly distinct (gold/amber) from secondary/muted. Primary has more chroma (0.08 vs 0.06).

**File:** `src/index.css`

## 3. Hero Header

**Replace current generic header with a statement-driven hero.**

Structure:
```
header
  ├─ gradient background (primary → deeper blue-purple, with subtle radial glow)
  ├─ top bar: Brain icon + "Cluster Headache Research Hub" + dark mode toggle button
  ├─ hero text: "The most painful condition known to medicine."
  │   subtitle: "Live clinical trials, research papers, and treatments — updated on every page load"
  └─ stats row: 4 stats with large numbers, contextual labels, subtle dividers
```

- Remove timestamp from prominent position → move to footer or make it a subtle "Last refreshed: ..." below stats
- Add a `<Button variant="ghost" size="icon">` with Sun/Moon icon for dark mode toggle in the top-right
- Stats numbers: `text-3xl font-extrabold` with `tabular-nums`
- Stats labels: `text-xs font-medium uppercase tracking-wider` (reduce from `tracking-widest`)
- Remove invisible dot-pattern overlay

**Files:** `src/components/layout/header.tsx`, `src/App.tsx` (pass theme toggle)

## 4. Replace Emoji with Lucide Icons

**Every section header emoji → Lucide icon in a tinted container.**

Mapping:
| Current | Replacement | Context |
|---------|-------------|---------|
| ⚡ The Basics | `<Zap />` | overview |
| 🔬 Current Research | `<Microscope />` | overview |
| 💊 What's Approved | `<Pill />` | overview |
| 🚨 Treatment Gap | `<AlertTriangle />` | overview |
| 📡 Patient Resources | `<Globe />` | overview |
| ⚡ Acute Abortives | `<Zap />` | treatments |
| 🛡️ Preventive | `<Shield />` | treatments |
| 🔬 In Active Trials | `<FlaskConical />` | treatments |
| 🚫 Prescribing Failures | `<Ban />` | treatments |
| 🏆 Community Priority | `<Trophy />` | community |
| 🍄 Busting Protocol | `<Leaf />` | community |
| ☀️ Vitamin D3 | `<Sun />` | community |
| ✅ During Active Cycle | `<CheckCircle />` | triggers |

Icon container: `<span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">` wrapping the icon at `size-4`.

**Files:** All tab components (overview, treatments, community, triggers)

## 5. Card Visual Hierarchy

Three card tiers:

**Tier 1 — Critical (Treatment Gap, disclaimers):**
- `border-l-4 border-l-destructive` (keep current)
- Add `bg-destructive/3` subtle background tint
- Slightly larger CardTitle

**Tier 2 — Standard (info cards, treatment cards):**
- Default Card styling, no changes needed
- Treatment cards keep their badge + border-l accent

**Tier 3 — Light (resources, metadata):**
- `variant="outline"` or lighter border treatment
- Smaller padding

**Files:** `overview-tab.tsx`, `community-tab.tsx`

## 6. Research Paper Cards

**Redesign paper cards for scannability.**

New structure per card:
```
Card (hover:shadow-md transition)
  ├─ left: year Badge (colored by recency: 2026/2025=success, 2024=info, older=secondary)
  ├─ center:
  │   ├─ title (font-semibold, link)
  │   ├─ authors (text-muted-foreground)
  │   └─ journal Badge (outline variant) + date
  └─ right: subtle external link icon
```

- Remove "PMID" as visual label — make it a tooltip or small text under the year badge
- Year badge gives immediate scan-ability
- Journal as Badge differentiates papers visually

**File:** `src/components/tabs/research-tab.tsx`

## 7. Tab Bar Polish

- Add `bg-muted/50 rounded-lg p-1` container around `TabsList`
- Active trigger: `bg-card shadow-sm` (lifted card effect) instead of `bg-primary`
- Inactive: `text-muted-foreground hover:text-foreground`
- Badge counts: increase to `text-[0.7rem]`
- Remove CSS override in index.css, use TabsList/TabsTrigger className

**Files:** `src/App.tsx`, `src/index.css` (remove custom tab CSS)

## 8. Spacing Rhythm

- Between major sections (h3 headers in treatments): `gap-10`
- Between cards within a section: `gap-4` (keep)
- Between tab header and first content: `gap-6`
- Separators: increase to `my-8` with slightly more opacity

**Files:** `treatments-tab.tsx`, `community-tab.tsx`, all tabs

## 9. Footer Redesign

**Two-column layout with more structure:**
```
footer (bg-primary, text-primary-foreground/60)
  ├─ left column:
  │   ├─ "Data sourced from ClinicalTrials.gov and PubMed"
  │   └─ "Community info from Clusterbusters, r/CH, patient literature"
  ├─ right column:
  │   ├─ "Not medical advice"
  │   └─ "Built 2026"
  └─ bottom center: "Press d to toggle dark mode" (keep as subtle hint)
```

**File:** `src/App.tsx`

## 10. Overview Tab Breathing Room

- "The Basics" card: add `bg-accent/30` subtle warm tint to make it the visual entry point
- Increase grid gap to `gap-6`
- Treatment Gap card: increase visual weight with larger title

**File:** `src/components/tabs/overview-tab.tsx`

---

## Out of Scope

- No new dependencies beyond DM Sans/DM Serif Display fonts
- No structural changes to data fetching or routing
- No new components — only visual modifications to existing ones
- No animation library — CSS transitions only

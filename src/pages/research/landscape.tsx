import { useMemo } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  BookOpen,
  FileText,
  FlaskConical,
  TrendingUp,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts"
import { useDataDb } from "@/lib/data-db"

const studyTypeConfig: ChartConfig = {
  count: { label: "Papers", color: "oklch(0.65 0.15 250)" },
}

const evidenceTierConfig: ChartConfig = {
  count: { label: "Papers", color: "oklch(0.6 0.15 280)" },
}

const papersPerYearConfig: ChartConfig = {
  papers: { label: "Papers", color: "oklch(0.65 0.15 250)" },
}

const categoryConfig: ChartConfig = {
  count: { label: "Papers", color: "oklch(0.65 0.15 160)" },
}

const CATEGORY_COLORS: Record<string, string> = {
  cgrp: "oklch(0.65 0.15 250)",
  psychedelic: "oklch(0.65 0.18 310)",
  neuromodulation: "oklch(0.6 0.15 280)",
  oxygen: "oklch(0.7 0.15 200)",
  "nerve-block": "oklch(0.65 0.15 45)",
  pharmacology: "oklch(0.6 0.15 160)",
  observational: "oklch(0.65 0.12 80)",
  "non-pharma": "oklch(0.7 0.12 140)",
  other: "oklch(0.55 0.05 250)",
  "vitamin-d": "oklch(0.7 0.15 90)",
}

function formatLabel(value: string): string {
  if (!value) return ""
  if (value === "rct") return "RCT"
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

const CATEGORY_LABELS: Record<string, string> = {
  cgrp: "CGRP",
  observational: "Observational",
  "non-pharma": "Non-Pharma",
  "nerve-block": "Nerve Block",
  other: "Other",
  pharmacology: "Pharmacology",
  psychedelic: "Psychedelic",
  oxygen: "Oxygen",
  neuromodulation: "Neuromodulation",
  "vitamin-d": "Vitamin D",
}

const TIER_LABELS: Record<number, string> = {
  1: "Strongest — Reviews of multiple studies",
  2: "Strong — Clinical trials with patients",
  3: "Moderate — Observational studies",
  4: "Weak — Individual case reports",
  5: "Preliminary — Lab research, editorials",
}

export function ResearchLandscape() {
  const { loading, getResearchStats } = useDataDb()

  const stats = useMemo(() => {
    if (loading) return null
    return getResearchStats()
  }, [loading, getResearchStats])

  const studyTypeData = useMemo(() => {
    if (!stats) return []
    return (stats.study_type_distribution as Array<{ type: string; count: number }>)
      .filter((s) => s.type !== "other")
      .sort((a, b) => a.count - b.count)
      .map((s) => ({
        type: formatLabel(s.type),
        count: s.count,
      }))
  }, [stats])

  const evidenceTierData = useMemo(() => {
    if (!stats) return []
    return (stats.evidence_tier_distribution as Array<{ tier: number; count: number }>).map((t) => ({
      tier: TIER_LABELS[t.tier] ?? `Tier ${t.tier}`,
      shortTier: `Tier ${t.tier}`,
      count: t.count,
    }))
  }, [stats])

  const papersPerYearData = useMemo(() => {
    if (!stats) return []
    const entries = Object.entries(stats.papers_per_year as Record<string, number>)
    const binned: Record<string, number> = {}
    for (const [year, count] of entries) {
      const y = parseInt(year)
      if (y >= 2000) {
        binned[year] = count
      } else {
        const bin = Math.floor(y / 5) * 5
        const label = `${bin}`
        binned[label] = (binned[label] ?? 0) + count
      }
    }
    return Object.entries(binned)
      .map(([year, papers]) => ({ year, papers }))
      .sort((a, b) => a.year.localeCompare(b.year))
  }, [stats])

  const categoryData = useMemo(() => {
    if (!stats) return []
    const totals: Record<string, number> = {}
    for (const [cat, results] of Object.entries(
      stats.category_results as Record<string, Array<{ result: string; count: number }>>
    )) {
      totals[cat] = results.reduce((sum, r) => sum + r.count, 0)
    }
    return Object.entries(totals)
      .filter(([cat]) => cat !== "other")
      .sort((a, b) => a[1] - b[1])
      .map(([cat, count]) => ({
        category: CATEGORY_LABELS[cat] ?? cat,
        count,
      }))
  }, [stats])

  const volumeConfig = useMemo(() => {
    const config: ChartConfig = {}
    const categories = ["psychedelic", "cgrp", "neuromodulation", "oxygen", "nerve-block"]
    for (const cat of categories) {
      config[cat] = {
        label: CATEGORY_LABELS[cat] ?? cat,
        color: CATEGORY_COLORS[cat] ?? "oklch(0.5 0.1 250)",
      }
    }
    return config
  }, [])

  const volumeData = useMemo(() => {
    if (!stats) return []
    const categories = ["psychedelic", "cgrp", "neuromodulation", "oxygen", "nerve-block"]
    const volumeByCategory = stats.research_volume_by_category as Record<string, Record<string, number>>
    const allYears = new Set<number>()
    for (const cat of categories) {
      const yearMap = volumeByCategory[cat]
      if (yearMap) {
        for (const y of Object.keys(yearMap)) allYears.add(parseInt(y))
      }
    }

    const sortedYears = Array.from(allYears).sort((a, b) => a - b)

    const binSize = 3
    const binned: Array<Record<string, string | number>> = []
    for (let i = 0; i < sortedYears.length; i += binSize) {
      const binYears = sortedYears.slice(i, i + binSize)
      const label =
        binYears.length === 1
          ? String(binYears[0])
          : `${binYears[0]}–${binYears[binYears.length - 1]}`
      const row: Record<string, string | number> = { year: label }
      for (const cat of categories) {
        const yearMap = volumeByCategory[cat]
        let sum = 0
        for (const y of binYears) {
          sum += yearMap?.[String(y)] ?? 0
        }
        row[cat] = sum
      }
      binned.push(row)
    }
    return binned
  }, [stats])

  if (loading || !stats) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-5 w-32" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-6 w-full max-w-2xl" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[80px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    )
  }

  const years = Object.keys(stats.papers_per_year as Record<string, number>)
  const yearRange = `${years[0]}–${years[years.length - 1]}`
  const rctCount =
    (stats.study_type_distribution as Array<{ type: string; count: number }>).find(
      (s) => s.type === "rct"
    )?.count ?? 0

  return (
    <div className="flex flex-col gap-8">
      <Link
        to="/research"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="size-4" />
        Back to Research
      </Link>

      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          The Research Landscape
        </h1>
        <p className="mt-2 text-lg text-muted-foreground leading-relaxed max-w-2xl">
          <span className="font-semibold text-foreground">
            {(stats.paper_count as number).toLocaleString()} papers
          </span>{" "}
          spanning {yearRange} — here is what cluster headache research looks
          like. From a handful of case reports in the 1940s to over 150 papers
          per year today, the field has exploded.
        </p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-400">
              <BookOpen className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {(stats.paper_count as number).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Total Papers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-purple-50 text-purple-500 dark:bg-purple-950/40 dark:text-purple-400">
              <FileText className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {(stats.papers_with_abstracts as number).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">With Summaries</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400">
              <FlaskConical className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rctCount}</p>
              <p className="text-xs text-muted-foreground">
                Randomized Controlled Trials
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{yearRange}</p>
              <p className="text-xs text-muted-foreground">Year Range</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Study Type + Evidence Tier side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Study Type Distribution</CardTitle>
            <CardDescription className="text-xs">
              What kinds of studies exist? "RCT" (randomized controlled trial) is the gold standard —
              patients are randomly assigned to treatment or placebo. "Basic science" means lab/imaging
              research, not patient studies. Only {rctCount} RCTs exist out of {(stats.paper_count as number).toLocaleString()} papers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={studyTypeConfig}
              style={{ height: `${studyTypeData.length * 24 + 24}px` }}
              className="w-full"
            >
              <BarChart
                data={studyTypeData}
                layout="vertical"
                margin={{ left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="type"
                  width={110}
                  tick={{ fontSize: 9 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Evidence Strength
            </CardTitle>
            <CardDescription className="text-xs">
              How reliable is the evidence? Tier 1 = strongest (large reviews combining multiple studies).
              Tier 2 = clinical trials with real patients. Tier 3 = observational studies.
              Tier 4-5 = case reports, editorials, lab research. Lower tier = more trustworthy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={evidenceTierConfig}
              className="min-h-[200px] w-full"
            >
              <BarChart data={evidenceTierData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="shortTier" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => {
                        const item = payload?.[0]?.payload as
                          | { tier?: string }
                          | undefined
                        return item?.tier ?? ""
                      }}
                    />
                  }
                />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Papers per Year + Category Breakdown side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Papers Published Per Year</CardTitle>
            <CardDescription className="text-xs">
              Research output grew steadily from the 1970s, with a sustained
              plateau of 100+ papers per year since the early 2000s.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={papersPerYearConfig}
              className="min-h-[200px] w-full"
            >
              <AreaChart data={papersPerYearData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 9 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="papers"
                  stroke="var(--color-papers)"
                  fill="var(--color-papers)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Papers by Treatment Category
            </CardTitle>
            <CardDescription className="text-xs">
              Nerve block and neuromodulation lead in volume. Psychedelic
              research is still small but growing fast.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={categoryConfig}
              style={{ height: `${categoryData.length * 24 + 24}px` }}
              className="w-full"
            >
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={100}
                  tick={{ fontSize: 10 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Research Volume by Category Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Research Volume by Category Over Time
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            CGRP research exploded after 2017 with the arrival of monoclonal
            antibodies. Psychedelic research, though small in absolute numbers,
            has grown from near-zero to a consistent presence since 2020.
          </p>
        </CardHeader>
        <CardContent>
          <ChartContainer config={volumeConfig} className="min-h-[200px] max-h-[300px] w-full">
            <AreaChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 9 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }} />
              {["nerve-block", "neuromodulation", "oxygen", "cgrp", "psychedelic"].map(
                (cat) => (
                  <Area
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    stackId="1"
                    stroke={CATEGORY_COLORS[cat]}
                    fill={CATEGORY_COLORS[cat]}
                    fillOpacity={0.3}
                    strokeWidth={1.5}
                  />
                )
              )}
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}

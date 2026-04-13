import { useEffect, useMemo, useState } from "react"
import { Link, useParams, Navigate } from "react-router-dom"
import { ArrowLeft, ExternalLink, FlaskConical, FileText, TrendingUp, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PaperCard } from "@/components/paper-card"
import { Separator } from "@/components/ui/separator"
import { Bar, BarChart, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { CATEGORY_CONFIG, STATUS_CONFIG, phaseLabel } from "@/lib/research-categories"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDataDb, type CategoryStats } from "@/lib/data-db"

const CATEGORY_META: Record<string, { name: string; description: string }> = {
  cgrp: { name: "CGRP Therapies", description: "Calcitonin gene-related peptide (CGRP) monoclonal antibodies and gepants. Galcanezumab is the only approved anti-CGRP for episodic CH." },
  "nerve-block": { name: "Nerve Blocks & Injections", description: "Greater occipital nerve blocks, sphenopalatine ganglion blocks, botulinum toxin injections. Procedural interventions for refractory cases." },
  neuromodulation: { name: "Neuromodulation & Stimulation", description: "Vagus nerve stimulation (gammaCore), occipital nerve stimulation, deep brain stimulation. Device-based therapies." },
  "non-pharma": { name: "Non-Pharmacological Approaches", description: "Light therapy, behavioral approaches, acupuncture, exercise, yoga. Alternative and complementary treatments." },
  observational: { name: "Observational & Epidemiological Studies", description: "Epidemiological studies, patient registries, natural history studies, and surveys describing CH patterns in populations." },
  other: { name: "Other Research", description: "Cross-cutting research: genetics, neuroimaging, pathophysiology, diagnostic criteria, and general headache medicine." },
  oxygen: { name: "Oxygen Therapy", description: "High-flow oxygen therapy — the community's #1 abortive. Evidence spans from early case reports to modern RCTs confirming 78% efficacy." },
  pharmacology: { name: "Pharmacological Treatments", description: "Traditional pharmaceutical treatments: verapamil, lithium, prednisone, melatonin, triptans. The established medical toolkit." },
  psychedelic: { name: "Psychedelic Treatments", description: "Psilocybin, LSD, BOL-148, and other psychedelic compounds for cluster headache. The community's most-discussed treatment category, now backed by Phase 2 clinical trials." },
  "vitamin-d": { name: "Vitamin D Research", description: "Vitamin D3 regimen (Batch protocol). Emerging research area with strong community anecdotal support but limited clinical trial data so far." },
}

const STUDY_TYPE_LABELS: Record<string, string> = {
  rct: "Clinical Trials (RCTs)",
  "clinical-trial": "Other Clinical Trials",
  "meta-analysis": "Meta-Analyses",
  meta_analysis: "Meta-Analyses",
  "systematic-review": "Systematic Reviews",
  observational: "Observational Studies",
  "case-report": "Case Reports",
  case_report: "Case Reports",
  "case-series": "Case Series",
  case_series: "Case Series",
  review: "Reviews",
  "basic-science": "Lab / Imaging Research",
  basic_science: "Lab / Imaging Research",
  guideline: "Guidelines",
  protocol: "Study Protocols",
  editorial: "Editorials / Letters",
  other: "Other",
}

const RESULT_LABELS: Record<string, string> = {
  positive: "Showed Benefit",
  showed_benefit: "Showed Benefit",
  negative: "No Benefit",
  no_benefit: "No Benefit",
  mixed: "Mixed Results",
  inconclusive: "Inconclusive",
  basic_science: "Basic Science",
  unknown: "Not Classifiable",
}

const RESULT_COLORS: Record<string, string> = {
  positive: "var(--chart-2)",
  showed_benefit: "var(--chart-2)",
  negative: "var(--chart-5)",
  no_benefit: "var(--chart-5)",
  mixed: "var(--chart-3)",
  inconclusive: "var(--chart-9)",
  basic_science: "var(--chart-4)",
  unknown: "var(--muted-foreground)",
}

const VERDICT_CONFIG: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "info" | "secondary" | "outline" }> = {
  success: { label: "Succeeded", variant: "success" },
  failure: { label: "Failed", variant: "destructive" },
  mixed: { label: "Mixed", variant: "warning" },
  ongoing: { label: "Ongoing", variant: "info" },
  terminated: { label: "Terminated", variant: "secondary" },
  unknown: { label: "No Results", variant: "outline" },
}

const chartConfig: ChartConfig = {
  count: { label: "Papers", color: "var(--chart-1)" },
}

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const { loading, getCategoryStats, searchPapers, searchTrials, getTrialAnalysis, getPaperAnalysis, getSubcategories } = useDataDb()

  const data = useMemo((): CategoryStats | null => {
    if (loading || !slug) return null
    return getCategoryStats(slug)
  }, [loading, slug, getCategoryStats])

  const subcategories = useMemo(() => {
    if (loading || !slug) return []
    return getSubcategories(slug)
  }, [loading, slug, getSubcategories])

  const [subcategoryFilter, setSubcategoryFilter] = useState<string | null>(null)

  // Reset filter when navigating between categories
  useEffect(() => {
    setSubcategoryFilter(null)
  }, [slug])

  // Get search terms for the active filter (all raw alias keys that map to the selected label)
  const activeSearchTerms = useMemo(() => {
    if (!subcategoryFilter) return null
    const sc = subcategories.find((s) => s.term === subcategoryFilter)
    return sc?.searchTerms ?? [subcategoryFilter.toLowerCase()]
  }, [subcategoryFilter, subcategories])

  const topPapers = useMemo(() => {
    if (loading || !slug) return []
    const limit = activeSearchTerms ? 5000 : 200
    const all = searchPapers({ category: slug, limit })
    if (!activeSearchTerms) return all.slice(0, 15)
    const terms = new Set(activeSearchTerms)
    return all.filter((p) => {
      const analysis = getPaperAnalysis(p.pmid)
      if (!analysis) return false
      return analysis.interventionsStudied.some((i) => terms.has(i.toLowerCase()))
    })
  }, [loading, slug, searchPapers, activeSearchTerms, getPaperAnalysis])

  const categoryTrials = useMemo(() => {
    if (loading || !slug) return []
    const all = searchTrials({ category: slug })
    if (!activeSearchTerms) return all
    const terms = new Set(activeSearchTerms)
    return all.filter((t) =>
      t.interventions.some((i) => {
        const low = i.toLowerCase()
        for (const term of terms) {
          if (low.includes(term) || term.includes(low)) return true
        }
        return false
      }),
    )
  }, [loading, slug, searchTrials, activeSearchTerms])

  // Compute filtered stats when a subcategory is selected
  const filteredStats = useMemo(() => {
    if (!subcategoryFilter) return null

    const analyses = topPapers.map((p) => getPaperAnalysis(p.pmid)).filter(Boolean)
    const activeTrials = categoryTrials.filter((t) =>
      ["RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING"].includes(t.status),
    )

    // Study type distribution
    const studyTypeCounts: Record<string, number> = {}
    for (const a of analyses) {
      if (a?.studyType) studyTypeCounts[a.studyType] = (studyTypeCounts[a.studyType] || 0) + 1
    }
    const studyTypeDistribution = Object.entries(studyTypeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)

    // Result distribution
    const resultCounts: Record<string, number> = {}
    for (const a of analyses) {
      const r = a?.outcome ?? "unknown"
      resultCounts[r] = (resultCounts[r] || 0) + 1
    }
    const resultDistribution = Object.entries(resultCounts)
      .map(([result, count]) => ({ result, count }))
      .sort((a, b) => b.count - a.count)

    // Papers per year
    const yearCounts: Record<string, number> = {}
    for (const p of topPapers) {
      if (p.pubDate) {
        const y = p.pubDate.slice(0, 4)
        yearCounts[y] = (yearCounts[y] || 0) + 1
      }
    }

    const positiveCount = (resultCounts["positive"] ?? 0) + (resultCounts["showed_benefit"] ?? 0)

    return {
      paperCount: topPapers.length,
      trialCount: categoryTrials.length,
      activeTrialCount: activeTrials.length,
      positiveCount,
      studyTypeDistribution,
      resultDistribution,
      papersPerYear: yearCounts,
    }
  }, [subcategoryFilter, topPapers, categoryTrials, getPaperAnalysis])

  if (!slug || (!loading && !data)) {
    return <Navigate to="/research" replace />
  }

  if (loading || !data) {
    return null
  }

  const meta = CATEGORY_META[data.category]
  const catConfig = CATEGORY_CONFIG[data.category]

  // Use filtered stats when a subcategory is selected, otherwise use pre-aggregated data
  const displayStats = filteredStats ?? {
    paperCount: data.paperCount,
    trialCount: data.trialCount,
    activeTrialCount: data.activeTrialCount,
    positiveCount: (data.resultDistribution.find((r) => r.result === "positive")?.count ?? 0) +
      (data.resultDistribution.find((r) => r.result === "showed_benefit")?.count ?? 0),
    studyTypeDistribution: data.studyTypeDistribution,
    resultDistribution: data.resultDistribution,
    papersPerYear: data.papersPerYear,
  }

  const yearData = Object.entries(displayStats.papersPerYear)
    .map(([year, count]) => ({ year, count }))
    .filter((d) => parseInt(d.year) >= 2000)
    .sort((a, b) => a.year.localeCompare(b.year))

  return (
    <div className="flex flex-col gap-8">
      <Link to="/research" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to Research
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">{meta?.name ?? catConfig?.label ?? slug}</h2>
          {catConfig && <Badge variant={catConfig.variant}>{catConfig.label}</Badge>}
        </div>
        {meta?.description && (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {meta.description}
          </p>
        )}
      </div>

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
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">All treatments</SelectItem>
              {subcategories.slice(0, 30).map((sc) => (
                <SelectItem key={sc.term} value={sc.term}>
                  {sc.term} ({sc.paperCount + sc.trialCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<FileText className="size-4" />} value={displayStats.paperCount} label="Papers" />
        <StatCard icon={<TrendingUp className="size-4" />} value={displayStats.positiveCount} label="Showed Benefit" />
        <StatCard icon={<FlaskConical className="size-4" />} value={displayStats.activeTrialCount} label="Active Trials" />
        <StatCard icon={<Users className="size-4" />} value={displayStats.trialCount} label="Trials" />
      </div>

      <Separator />

      {/* Study Types + Results side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Study Types</CardTitle>
            <CardDescription className="text-xs">
              What kinds of research has been done in this area?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} style={{ height: `${Math.min(displayStats.studyTypeDistribution.length, 8) * 24 + 24}px` }} className="w-full">
              <BarChart data={displayStats.studyTypeDistribution.slice(0, 8)} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="type"
                  tick={{ fontSize: 9 }}
                  width={100}
                  tickFormatter={(v) => STUDY_TYPE_LABELS[v] ?? v}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Study Outcomes</CardTitle>
            <CardDescription className="text-xs">
              Did the treatment work? Results across all studies in this category.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 pt-2">
              {displayStats.resultDistribution
                .filter((r) => r.result !== "unknown")
                .map((r) => {
                  const total = displayStats.resultDistribution.reduce((s, x) => s + x.count, 0)
                  const pct = total > 0 ? Math.round((r.count / total) * 100) : 0
                  return (
                    <div key={r.result} className="flex items-center gap-3">
                      <span className="w-24 text-xs font-medium">{RESULT_LABELS[r.result] ?? r.result}</span>
                      <div className="flex-1 rounded-full bg-muted h-3 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: RESULT_COLORS[r.result] ?? "var(--chart-1)" }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{r.count}</span>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Research Volume Over Time */}
      {yearData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Research Volume Over Time</CardTitle>
            <CardDescription className="text-xs">
              Papers published per year since 2000. Growing interest shows this area is gaining attention.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="min-h-[200px] max-h-[300px] w-full">
              <AreaChart data={yearData} margin={{ left: 0, right: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area dataKey="count" type="monotone" fill="var(--chart-1)" stroke="var(--chart-1)" fillOpacity={0.2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* No results message */}
      {subcategoryFilter && topPapers.length === 0 && categoryTrials.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <FileText className="size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No papers or trials found matching "{subcategoryFilter}"
          </p>
        </div>
      )}

      {/* Key Studies */}
      {topPapers.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">
            Key Studies
            {subcategoryFilter && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({topPapers.length} matching "{subcategoryFilter}")
              </span>
            )}
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            The most important papers in this category, ranked by evidence strength and sample size.
          </p>
          <div className="flex flex-col gap-2">
            {topPapers.map((p) => (
              <PaperCard key={p.pmid} paper={p} />
            ))}
          </div>
        </div>
      )}

      {/* All Trials with Analysis */}
      {categoryTrials.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="mb-2 text-lg font-semibold">
              Clinical Trials
              {subcategoryFilter && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({categoryTrials.length} matching "{subcategoryFilter}")
                </span>
              )}
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              {categoryTrials.length} trials in this category — what was tested, what happened, and what's coming.
            </p>
            <div className="flex flex-col gap-3">
              {categoryTrials.map((t) => {
                const analysis = getTrialAnalysis(t.nctId)
                const statCfg = STATUS_CONFIG[t.status]
                const verdictCfg = VERDICT_CONFIG[analysis?.verdict ?? "unknown"]
                return (
                  <Card key={t.nctId} className="hover:shadow-sm transition-all">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm font-semibold leading-snug">{t.title}</h4>
                        <a
                          href={`https://clinicaltrials.gov/study/${t.nctId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{t.sponsor}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {statCfg && <Badge variant={statCfg.variant} className="text-[0.6rem]">{statCfg.label}</Badge>}
                        {verdictCfg && <Badge variant={verdictCfg.variant} className="text-[0.6rem]">{verdictCfg.label}</Badge>}
                        <Badge variant="outline" className="text-[0.6rem]">{phaseLabel(t.phase)}</Badge>
                        {t.enrollment && <span className="text-[0.6rem] text-muted-foreground">n={t.enrollment}</span>}
                        {analysis?.doseTested && <Badge variant="outline" className="text-[0.6rem]">{analysis.doseTested}</Badge>}
                      </div>

                      {analysis?.whatTested && (
                        <div className="mt-3 rounded-md bg-muted/40 p-3">
                          <p className="text-xs leading-relaxed">
                            <span className="font-medium">What was tested: </span>
                            <span className="text-muted-foreground">{analysis.whatTested}</span>
                          </p>
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
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-[0.65rem] font-medium uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-xl font-bold tabular-nums tracking-tight">{value}</span>
      </CardContent>
    </Card>
  )
}

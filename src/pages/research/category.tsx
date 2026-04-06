import { useMemo } from "react"
import { Link, useParams, Navigate } from "react-router-dom"
import { ArrowLeft, ExternalLink, FlaskConical, FileText, TrendingUp, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Bar, BarChart, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { CATEGORY_CONFIG, STATUS_CONFIG, phaseLabel } from "@/lib/research-categories"

// Import all category data files
const categoryModules = import.meta.glob("@/data/research-insights/categories/*.json", { eager: true }) as Record<string, { default: CategoryData }>

interface CategoryData {
  category: string
  name: string
  description: string
  total_papers: number
  total_trials: number
  active_trials: number
  with_abstracts: number
  study_type_distribution: Array<{ type: string; count: number }>
  result_distribution: Array<{ result: string; count: number }>
  papers_per_year: Record<string, number>
  avg_sample_size: number | null
  max_sample_size: number | null
  top_papers: Array<{
    pmid: string; title: string; authors: string; year: string
    journal: string; study_type: string; result: string
    sample_size: number | null; evidence_tier: number
  }>
  all_trials: Array<{
    nct_id: string; title: string; status: string
    phase: string[]; sponsor: string; enrollment: number | null
    what_tested?: string; key_result?: string; verdict?: string
    patient_relevance?: string; dose_tested?: string | null
  }>
  active_trial_count: number
}

function getCategoryData(slug: string): CategoryData | null {
  const key = Object.keys(categoryModules).find((k) => k.includes(`/${slug}.json`))
  if (!key) return null
  const mod = categoryModules[key] as { default: CategoryData } | CategoryData
  return "default" in mod ? mod.default : (mod as CategoryData)
}

const STUDY_TYPE_LABELS: Record<string, string> = {
  rct: "Clinical Trials (RCTs)",
  "clinical-trial": "Other Clinical Trials",
  "meta-analysis": "Meta-Analyses",
  "systematic-review": "Systematic Reviews",
  observational: "Observational Studies",
  "case-report": "Case Reports",
  "case-series": "Case Series",
  review: "Reviews",
  "basic-science": "Lab / Imaging Research",
  guideline: "Guidelines",
  protocol: "Study Protocols",
  editorial: "Editorials / Letters",
  other: "Other",
}

const RESULT_LABELS: Record<string, string> = {
  positive: "Showed Benefit",
  negative: "No Benefit",
  mixed: "Mixed Results",
  inconclusive: "Inconclusive",
  unknown: "Not Classifiable",
}

const RESULT_COLORS: Record<string, string> = {
  positive: "var(--chart-2)",
  negative: "var(--chart-5)",
  mixed: "var(--chart-3)",
  inconclusive: "var(--chart-9)",
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
  const data = useMemo(() => (slug ? getCategoryData(slug) : null), [slug])

  if (!slug || !data) {
    return <Navigate to="/research" replace />
  }

  const catConfig = CATEGORY_CONFIG[data.category]
  const yearData = Object.entries(data.papers_per_year)
    .map(([year, count]) => ({ year, count }))
    .filter((d) => parseInt(d.year) >= 2000)
  const positiveCount = data.result_distribution.find((r) => r.result === "positive")?.count ?? 0

  return (
    <div className="flex flex-col gap-8">
      <Link to="/research" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to Research
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">{data.name}</h2>
          {catConfig && <Badge variant={catConfig.variant}>{catConfig.label}</Badge>}
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {data.description}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<FileText className="size-4" />} value={data.total_papers} label="Papers" />
        <StatCard icon={<TrendingUp className="size-4" />} value={positiveCount} label="Showed Benefit" />
        <StatCard icon={<FlaskConical className="size-4" />} value={data.active_trials} label="Active Trials" />
        <StatCard icon={<Users className="size-4" />} value={data.avg_sample_size ?? "—"} label="Avg Sample Size" />
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
            <ChartContainer config={chartConfig} style={{ height: `${Math.min(data.study_type_distribution.length, 8) * 28 + 30}px` }} className="w-full">
              <BarChart data={data.study_type_distribution.slice(0, 8)} layout="vertical" margin={{ left: 8 }}>
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
              {data.result_distribution
                .filter((r) => r.result !== "unknown")
                .map((r) => {
                  const total = data.result_distribution.reduce((s, x) => s + x.count, 0)
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
            <ChartContainer config={chartConfig} className="aspect-[21/9] w-full">
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

      {/* Key Studies */}
      {data.top_papers.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">Key Studies</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            The most important papers in this category, ranked by evidence strength and sample size.
          </p>
          <div className="flex flex-col gap-2">
            {data.top_papers.map((p) => (
              <Card key={p.pmid} className="hover:shadow-sm transition-all">
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium leading-snug">{p.title}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">{p.authors}</p>
                    </div>
                    <a
                      href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {p.result && (
                      <Badge
                        variant={p.result === "positive" ? "success" : p.result === "negative" ? "destructive" : "secondary"}
                        className="text-[0.6rem]"
                      >
                        {RESULT_LABELS[p.result] ?? p.result}
                      </Badge>
                    )}
                    {p.study_type && (
                      <Badge variant="outline" className="text-[0.6rem]">
                        {STUDY_TYPE_LABELS[p.study_type] ?? p.study_type}
                      </Badge>
                    )}
                    {p.year && (
                      <Badge variant="outline" className="text-[0.6rem]">{p.year}</Badge>
                    )}
                    {p.sample_size && (
                      <span className="text-[0.6rem] text-muted-foreground">n={p.sample_size}</span>
                    )}
                    <span className="text-[0.6rem] text-muted-foreground">{p.journal}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Trials with Analysis */}
      {data.all_trials.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="mb-2 text-lg font-semibold">Clinical Trials</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              {data.all_trials.length} trials in this category — what was tested, what happened, and what's coming.
            </p>
            <div className="flex flex-col gap-3">
              {data.all_trials.map((t) => {
                const statCfg = STATUS_CONFIG[t.status]
                const verdictCfg = VERDICT_CONFIG[t.verdict ?? "unknown"]
                return (
                  <Card key={t.nct_id} className="hover:shadow-sm transition-all">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm font-semibold leading-snug">{t.title}</h4>
                        <a
                          href={`https://clinicaltrials.gov/study/${t.nct_id}`}
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
                        {t.dose_tested && <Badge variant="outline" className="text-[0.6rem]">{t.dose_tested}</Badge>}
                      </div>

                      {t.what_tested && (
                        <div className="mt-3 rounded-md bg-muted/40 p-3">
                          <p className="text-xs leading-relaxed">
                            <span className="font-medium">What was tested: </span>
                            <span className="text-muted-foreground">{t.what_tested}</span>
                          </p>
                          {t.key_result && (
                            <p className="mt-1.5 text-xs leading-relaxed">
                              <span className="font-medium">Result: </span>
                              <span className="text-muted-foreground">{t.key_result}</span>
                            </p>
                          )}
                          {t.patient_relevance && (
                            <p className="mt-1.5 text-xs leading-relaxed">
                              <span className="font-medium">For patients: </span>
                              <span className="text-muted-foreground">{t.patient_relevance}</span>
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

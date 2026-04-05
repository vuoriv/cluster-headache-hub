import { useMemo } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FlaskConical,
  Activity,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts"
import paperStats from "@/data/research-insights/paper-stats.json"
import trialStats from "@/data/research-insights/trial-stats.json"

const RESULT_COLORS: Record<string, string> = {
  positive: "oklch(0.65 0.18 155)",
  negative: "oklch(0.6 0.18 25)",
  mixed: "oklch(0.7 0.15 85)",
  inconclusive: "oklch(0.6 0.08 250)",
  unknown: "oklch(0.5 0.03 250)",
}

const RESULT_LABELS: Record<string, string> = {
  positive: "Positive",
  negative: "Negative",
  mixed: "Mixed",
  inconclusive: "Inconclusive",
  unknown: "Unknown",
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

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Completed",
  TERMINATED: "Terminated",
  RECRUITING: "Recruiting",
  NOT_YET_RECRUITING: "Not Yet Recruiting",
  ACTIVE_NOT_RECRUITING: "Active, Not Recruiting",
  ENROLLING_BY_INVITATION: "Enrolling by Invitation",
  WITHDRAWN: "Withdrawn",
  SUSPENDED: "Suspended",
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "oklch(0.6 0.12 250)",
  TERMINATED: "oklch(0.6 0.15 25)",
  RECRUITING: "oklch(0.65 0.18 155)",
  NOT_YET_RECRUITING: "oklch(0.7 0.12 200)",
  ACTIVE_NOT_RECRUITING: "oklch(0.65 0.15 85)",
  ENROLLING_BY_INVITATION: "oklch(0.7 0.12 280)",
  WITHDRAWN: "oklch(0.5 0.1 25)",
  SUSPENDED: "oklch(0.55 0.08 45)",
}

const resultPieConfig: ChartConfig = {
  positive: { label: "Positive", color: RESULT_COLORS.positive },
  negative: { label: "Negative", color: RESULT_COLORS.negative },
  mixed: { label: "Mixed", color: RESULT_COLORS.mixed },
  inconclusive: { label: "Inconclusive", color: RESULT_COLORS.inconclusive },
}

const evidenceQualityConfig: ChartConfig = {
  score: { label: "Avg Evidence Tier", color: "oklch(0.6 0.15 280)" },
}

const categoryResultConfig: ChartConfig = {
  positive: { label: "Positive", color: RESULT_COLORS.positive },
  negative: { label: "Negative", color: RESULT_COLORS.negative },
  mixed: { label: "Mixed", color: RESULT_COLORS.mixed },
}

const trialStatusConfig: ChartConfig = {
  count: { label: "Trials", color: "oklch(0.6 0.12 250)" },
}

const sponsorConfig: ChartConfig = {
  count: { label: "Trials", color: "oklch(0.65 0.15 45)" },
}

export function EvidenceDashboard() {
  const knownResults = useMemo(
    () =>
      paperStats.result_distribution.filter(
        (r) => r.result !== "unknown"
      ),
    []
  )

  const totalKnown = useMemo(
    () => knownResults.reduce((sum, r) => sum + r.count, 0),
    [knownResults]
  )

  const positiveCount =
    paperStats.result_distribution.find((r) => r.result === "positive")
      ?.count ?? 0
  const negativeCount =
    paperStats.result_distribution.find((r) => r.result === "negative")
      ?.count ?? 0
  const positivePercent = Math.round((positiveCount / totalKnown) * 100)
  const negativePercent = Math.round((negativeCount / totalKnown) * 100)

  const activeTrials = useMemo(
    () =>
      trialStats.status_distribution
        .filter((s) =>
          ["RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION"].includes(
            s.status
          )
        )
        .reduce((sum, s) => sum + s.count, 0),
    []
  )

  const rctPositive = useMemo(() => {
    // Approximate: among papers with known results, positive fraction
    // This is a simplified view from the available data
    const rctCount =
      paperStats.study_type_distribution.find((s) => s.type === "rct")
        ?.count ?? 0
    return rctCount
  }, [])

  const resultPieData = useMemo(
    () =>
      knownResults
        .filter((r) => r.result !== "unknown")
        .map((r) => ({
          name: RESULT_LABELS[r.result] ?? r.result,
          value: r.count,
          key: r.result,
        })),
    [knownResults]
  )

  const evidenceQualityData = useMemo(
    () =>
      Object.entries(paperStats.category_avg_evidence)
        .filter(([cat]) => cat !== "other")
        .sort((a, b) => a[1] - b[1])
        .map(([cat, score]) => ({
          category: CATEGORY_LABELS[cat] ?? cat,
          score: Number(score.toFixed(2)),
        })),
    []
  )

  const categoryResultData = useMemo(() => {
    const categories = Object.entries(paperStats.category_results)
      .filter(([cat]) => cat !== "other")
      .map(([cat, results]) => {
        const pos = results.find((r) => r.result === "positive")?.count ?? 0
        const neg = results.find((r) => r.result === "negative")?.count ?? 0
        const mix = results.find((r) => r.result === "mixed")?.count ?? 0
        return {
          category: CATEGORY_LABELS[cat] ?? cat,
          positive: pos,
          negative: neg,
          mixed: mix,
          total: pos + neg + mix,
        }
      })
      .sort((a, b) => b.total - a.total)
    return categories
  }, [])

  const trialStatusData = useMemo(
    () =>
      trialStats.status_distribution.map((s) => ({
        status: STATUS_LABELS[s.status] ?? s.status,
        count: s.count,
        key: s.status,
      })),
    []
  )

  const topSponsorsData = useMemo(
    () =>
      trialStats.top_sponsors.slice(0, 10).map((s) => ({
        sponsor:
          s.sponsor.length > 35 ? s.sponsor.slice(0, 33) + "..." : s.sponsor,
        fullName: s.sponsor,
        count: s.count,
      })),
    []
  )

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
          Evidence Dashboard
        </h1>
        <p className="mt-2 text-lg text-muted-foreground leading-relaxed max-w-2xl">
          Which treatments have real evidence? Of papers with classifiable
          results,{" "}
          <span className="font-semibold text-foreground">
            {positivePercent}% report positive outcomes
          </span>{" "}
          — but RCTs tell a different story than case reports. Here is how the
          evidence stacks up.
        </p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{positivePercent}%</p>
              <p className="text-xs text-muted-foreground">Studies Showing Benefit</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400">
              <XCircle className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{negativePercent}%</p>
              <p className="text-xs text-muted-foreground">Studies Showing No Benefit</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-400">
              <FlaskConical className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rctPositive}</p>
              <p className="text-xs text-muted-foreground">Clinical Trials (RCTs)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400">
              <Activity className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeTrials}</p>
              <p className="text-xs text-muted-foreground">
                Active Clinical Trials
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Result Distribution + Evidence Quality side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Study Outcomes</CardTitle>
            <CardDescription className="text-xs">
              Did the treatment work? "Positive" = the treatment showed clear benefit.
              "Negative" = it didn't work. "Mixed" = some benefit but not convincing.
              "Inconclusive" = the study wasn't testing a treatment (lab research, reviews).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={resultPieConfig}
              className="h-[300px] w-full"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={resultPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  strokeWidth={2}
                  stroke="var(--background)"
                >
                  {resultPieData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={RESULT_COLORS[entry.key] ?? RESULT_COLORS.inconclusive}
                    />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Evidence Strength by Treatment
            </CardTitle>
            <CardDescription className="text-xs">
              Which treatments have the strongest research backing? Lower score = better evidence.
              A score near 2 means mostly clinical trials with real patients. Near 4 means mostly
              case reports and lab studies. Psychedelic and vitamin D research tends to be
              higher quality because it's newer and uses modern trial designs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={evidenceQualityConfig}
              className="h-[300px] w-full"
            >
              <BarChart
                data={evidenceQualityData}
                layout="vertical"
                margin={{ left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  domain={[0, 5]}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={120}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="score"
                  fill="var(--color-score)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Per-Category Result Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Does It Work? Results by Treatment Category
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            For each treatment category, how many studies found it effective (positive),
            ineffective (negative), or somewhere in between (mixed)?
            Psychedelic research stands out: 27 positive results with zero negative.
          </p>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={categoryResultConfig}
            className="h-[350px] w-full"
          >
            <BarChart data={categoryResultData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="category"
                tick={{ fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Bar
                dataKey="positive"
                fill={RESULT_COLORS.positive}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="negative"
                fill={RESULT_COLORS.negative}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="mixed"
                fill={RESULT_COLORS.mixed}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Separator />

      {/* Clinical Trials Section */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Clinical Trials</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Data from {trialStats.total_trials} registered clinical trials on
          ClinicalTrials.gov.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trial Status Distribution</CardTitle>
            <CardDescription className="text-xs">
              {trialStats.status_distribution.find((s) => s.status === "COMPLETED")?.count ?? 0}{" "}
              completed,{" "}
              {trialStats.status_distribution.find((s) => s.status === "RECRUITING")?.count ?? 0}{" "}
              currently recruiting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={trialStatusConfig}
              className="h-[280px] w-full"
            >
              <BarChart
                data={trialStatusData}
                layout="vertical"
                margin={{ left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="status"
                  width={170}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent />
                  }
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {trialStatusData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={STATUS_COLORS[entry.key] ?? "oklch(0.6 0.1 250)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Trial Sponsors</CardTitle>
            <CardDescription className="text-xs">
              Academic medical centers dominate CH clinical research. Leiden,
              NTNU, and the Danish Headache Center lead with 5 trials each.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={sponsorConfig}
              className="h-[280px] w-full"
            >
              <BarChart
                data={topSponsorsData}
                layout="vertical"
                margin={{ left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="sponsor"
                  width={200}
                  tick={{ fontSize: 10 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => {
                        const item = payload?.[0]?.payload as
                          | { fullName?: string }
                          | undefined
                        return item?.fullName ?? ""
                      }}
                    />
                  }
                />
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
    </div>
  )
}

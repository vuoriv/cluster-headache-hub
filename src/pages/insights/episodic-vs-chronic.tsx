import { useMemo } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Repeat,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts"
import { useDataDb } from "@/lib/data-db"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

interface EpisodicChronicData {
  post_counts: { episodic: number; chronic: number; both: number; unspecified: number }
  conversion_mentions: number
  episodic_treatments: Array<{ treatment: string; count: number }>
  chronic_treatments: Array<{ treatment: string; count: number }>
  episodic_positive_rate: number
  chronic_positive_rate: number
  episodic_negative_rate: number
  chronic_negative_rate: number
}

const comparisonChartConfig: ChartConfig = {
  episodic: { label: "Episodic", color: "hsl(260, 60%, 55%)" },
  chronic: { label: "Chronic", color: "hsl(330, 60%, 50%)" },
}

export function EpisodicVsChronic() {
  const { loading, getInsight } = useDataDb()
  const data = getInsight<EpisodicChronicData>("episodic-vs-chronic")

  const comparisonData = useMemo(() => {
    if (!data) return []
    const episodicMap = new Map(
      data.episodic_treatments.map((t) => [t.treatment, t.count]),
    )
    const chronicMap = new Map(
      data.chronic_treatments.map((t) => [t.treatment, t.count]),
    )

    const allTreatments = new Set([
      ...data.episodic_treatments.map((t) => t.treatment),
      ...data.chronic_treatments.map((t) => t.treatment),
    ])

    return Array.from(allTreatments)
      .map((treatment) => ({
        treatment,
        episodic: episodicMap.get(treatment) ?? 0,
        chronic: chronicMap.get(treatment) ?? 0,
        total: (episodicMap.get(treatment) ?? 0) + (chronicMap.get(treatment) ?? 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12)
  }, [data])

  if (loading) {
    return <EpisodicChronicSkeleton />
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          to="/clusterbusters/insights"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Insights
        </Link>
        <p className="text-muted-foreground">No data available.</p>
      </div>
    )
  }

  const totalTyped = data.post_counts.episodic + data.post_counts.chronic + data.post_counts.both
  const chronicRatio =
    data.post_counts.episodic > 0
      ? (data.post_counts.chronic / data.post_counts.episodic).toFixed(1)
      : "N/A"

  return (
    <div className="flex flex-col gap-8">
      {/* Back link */}
      <Link
        to="/clusterbusters/insights"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to Insights
      </Link>

      {/* Hero */}
      <div className="flex flex-col gap-3">
        <Badge variant="secondary" className="w-fit">
          Episodic vs Chronic
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">
          Chronic patients search {chronicRatio}x harder for answers
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          Among {totalTyped.toLocaleString()} posts where we could identify the CH type, chronic
          patients discuss treatments significantly more than episodic patients. They gravitate
          toward different solutions too — and their success rates tell a different story.
        </p>
      </div>

      <Separator />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={MessageSquare}
          label="Episodic Posts"
          value={data.post_counts.episodic.toLocaleString()}
          accent="purple"
        />
        <StatCard
          icon={MessageSquare}
          label="Chronic Posts"
          value={data.post_counts.chronic.toLocaleString()}
          accent="pink"
        />
        <StatCard
          icon={TrendingUp}
          label="Episodic Positive Rate"
          value={`${data.episodic_positive_rate.toFixed(1)}%`}
          accent="green"
        />
        <StatCard
          icon={TrendingDown}
          label="Chronic Positive Rate"
          value={`${data.chronic_positive_rate.toFixed(1)}%`}
          accent="amber"
        />
      </div>

      {/* Conversion callout */}
      <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="flex items-start gap-4 pt-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
            <Repeat className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold">
              {data.conversion_mentions.toLocaleString()} conversion mentions detected
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">
              These are posts where patients discuss transitioning between episodic and chronic
              forms. Episodic-to-chronic conversion is one of the most feared aspects of cluster
              headache — and one of the least understood. Each mention represents a patient grappling
              with a fundamental change in their condition.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Treatment comparison + Outcome rates side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Treatment Preferences</CardTitle>
            <CardDescription className="text-xs">
              Chronic patients lean toward preventives and alternatives; episodic focus on acute abortives.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={comparisonChartConfig} className="h-[280px] w-full">
              <BarChart data={comparisonData} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 80 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="treatment" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} width={80} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="episodic" fill="var(--color-episodic)" radius={[0, 4, 4, 0]} barSize={8} />
                <Bar dataKey="chronic" fill="var(--color-chronic)" radius={[0, 4, 4, 0]} barSize={8} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Who Reports Better Outcomes?</CardTitle>
            <CardDescription className="text-xs">
              Positive vs negative sentiment in treatment discussions by CH type.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              <OutcomeBlock
                label="Episodic"
                positive={data.episodic_positive_rate}
                negative={data.episodic_negative_rate}
                color="hsl(260, 60%, 55%)"
              />
              <OutcomeBlock
                label="Chronic"
                positive={data.chronic_positive_rate}
                negative={data.chronic_negative_rate}
                color="hsl(330, 60%, 50%)"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Closing */}
      <Card className="border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20">
        <CardContent className="pt-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Why this matters:</span> Episodic and
            chronic CH are often treated as variants of the same condition, but the community data
            shows they represent fundamentally different patient experiences. Chronic patients are
            more active, more experimental, and face lower success rates — insights that should
            inform both clinical practice and community support.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  accent: "purple" | "pink" | "green" | "amber"
}) {
  const accentStyles = {
    purple:
      "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400",
    pink: "bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400",
    green:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
    amber:
      "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  }

  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-5">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${accentStyles[accent]}`}
        >
          <Icon className="size-4" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-xl font-bold">{value}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function OutcomeBlock({
  label,
  positive,
  negative,
  color,
}: {
  label: string
  positive: number
  negative: number
  color: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <div className="size-3 rounded-sm" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Positive</span>
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {positive.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${Math.min(positive, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Negative</span>
          <span className="text-sm font-medium text-red-600 dark:text-red-400">
            {negative.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-red-500"
            style={{ width: `${Math.min(negative, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function EpisodicChronicSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-16 w-2/3" />
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-5">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-5">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <Skeleton className="aspect-[3/2] w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

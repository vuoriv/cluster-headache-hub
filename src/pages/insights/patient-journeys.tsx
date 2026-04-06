import { useMemo } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Users, Clock, RefreshCw, CalendarRange } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
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

interface PatientJourneyData {
  total_returning_users: number
  users_with_gaps: number
  avg_year_span: number
  max_year_span: number
  span_distribution: Record<string, number>
  users_by_active_years: Record<string, number>
  return_after_gap_treatments: Array<{ treatment: string; count: number }>
  returning_per_year: Record<string, number>
}

const SPAN_COLORS = [
  "hsl(210, 70%, 55%)",
  "hsl(210, 65%, 48%)",
  "hsl(210, 60%, 42%)",
  "hsl(210, 55%, 36%)",
  "hsl(210, 50%, 30%)",
  "hsl(210, 45%, 24%)",
]

const TREATMENT_COLORS = [
  "hsl(160, 60%, 45%)",
  "hsl(160, 55%, 40%)",
  "hsl(160, 50%, 35%)",
  "hsl(160, 45%, 30%)",
  "hsl(160, 40%, 28%)",
  "hsl(160, 35%, 25%)",
  "hsl(160, 30%, 22%)",
  "hsl(160, 25%, 20%)",
  "hsl(160, 20%, 18%)",
  "hsl(160, 15%, 16%)",
]

const spanChartConfig: ChartConfig = {
  count: { label: "Users", color: "hsl(210, 70%, 55%)" },
}

const treatmentChartConfig: ChartConfig = {
  count: { label: "Mentions", color: "hsl(160, 60%, 45%)" },
}

export function PatientJourneys() {
  const { loading, getInsight } = useDataDb()
  const data = getInsight<PatientJourneyData>("patient-journeys")

  const spanData = useMemo(() => {
    if (!data?.span_distribution) return []
    const order = ["<1 year", "1-2 years", "3-5 years", "6-10 years", "10+ years"]
    return order
      .filter((label) => label in data.span_distribution)
      .map((label) => ({ label, count: data.span_distribution[label] }))
  }, [data])

  const treatmentData = useMemo(() => {
    if (!data?.return_after_gap_treatments) return []
    return data.return_after_gap_treatments.slice(0, 10)
  }, [data])

  if (loading) {
    return <PatientJourneysSkeleton />
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
          Patient Journeys
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">
          {data.users_with_gaps.toLocaleString()} patients returned after years of silence
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          Cluster headache is relentless. Of {data.total_returning_users.toLocaleString()} returning
          forum users tracked across multiple years, {data.users_with_gaps.toLocaleString()} came
          back after a gap in activity — proving that remission periods end, cycles return, and
          patients need support again. The longest gap? {data.max_year_span} years.
        </p>
      </div>

      <Separator />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={Users}
          label="Returning Users"
          value={data.total_returning_users.toLocaleString()}
          description="Active across multiple years"
        />
        <StatCard
          icon={RefreshCw}
          label="Returned After Gap"
          value={data.users_with_gaps.toLocaleString()}
          description="Came back after remission"
        />
        <StatCard
          icon={Clock}
          label="Avg. Year Span"
          value={`${data.avg_year_span} years`}
          description="Average activity window"
        />
        <StatCard
          icon={CalendarRange}
          label="Longest Journey"
          value={`${data.max_year_span} years`}
          description="Maximum span tracked"
        />
      </div>

      {/* Charts side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">How long do patients stay engaged?</CardTitle>
            <CardDescription className="text-xs">
              From first post to last. Long spans suggest chronic sufferers or recurring cycles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={spanChartConfig} className="min-h-[200px] w-full">
              <BarChart data={spanData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {spanData.map((_, i) => (
                    <Cell key={i} fill={SPAN_COLORS[i % SPAN_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">What do returning patients discuss?</CardTitle>
            <CardDescription className="text-xs">
              Treatments discussed when patients return after a gap in activity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={treatmentChartConfig} style={{ height: `${treatmentData.length * 24 + 24}px` }} className="w-full">
              <BarChart data={treatmentData} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="treatment" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} width={80} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {treatmentData.map((_, i) => (
                    <Cell key={i} fill={TREATMENT_COLORS[i % TREATMENT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Closing context */}
      <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="pt-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Why this matters:</span> Cluster
            headache cycles can go dormant for years, leading patients to believe they're cured.
            This data shows that{" "}
            {Math.round((data.users_with_gaps / data.total_returning_users) * 100)}% of
            multi-year users experienced a gap before returning — a powerful reminder that ongoing
            awareness and community access matter even during remission.
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
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  description: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
          <Icon className="size-4" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-xl font-bold">{value}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function PatientJourneysSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-28" />
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
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <Skeleton className="aspect-[2/1] w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <Skeleton className="aspect-[2/1] w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

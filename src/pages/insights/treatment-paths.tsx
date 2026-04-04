import { useMemo } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  Users,
  Pill,
  TrendingUp,
} from "lucide-react"
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

interface TreatmentPathData {
  users_with_progression: number
  first_treatments: Array<{ treatment: string; count: number }>
  final_treatments: Array<{ treatment: string; count: number }>
  top_transitions: Array<{ from: string; to: string; count: number }>
}

const FIRST_COLORS = [
  "hsl(220, 65%, 55%)",
  "hsl(220, 60%, 50%)",
  "hsl(220, 55%, 45%)",
  "hsl(220, 50%, 40%)",
  "hsl(220, 45%, 36%)",
  "hsl(220, 40%, 32%)",
  "hsl(220, 35%, 28%)",
  "hsl(220, 30%, 25%)",
  "hsl(220, 25%, 22%)",
  "hsl(220, 20%, 20%)",
]

const FINAL_COLORS = [
  "hsl(150, 60%, 42%)",
  "hsl(150, 55%, 38%)",
  "hsl(150, 50%, 34%)",
  "hsl(150, 45%, 30%)",
  "hsl(150, 40%, 27%)",
  "hsl(150, 35%, 24%)",
  "hsl(150, 30%, 21%)",
  "hsl(150, 25%, 18%)",
  "hsl(150, 20%, 16%)",
  "hsl(150, 15%, 14%)",
]

const firstChartConfig: ChartConfig = {
  count: { label: "Users", color: "hsl(220, 65%, 55%)" },
}

const finalChartConfig: ChartConfig = {
  count: { label: "Users", color: "hsl(150, 60%, 42%)" },
}

export function TreatmentPaths() {
  const { loading, getInsight } = useDataDb()
  const data = getInsight<TreatmentPathData>("treatment-paths")

  const firstData = useMemo(() => {
    if (!data?.first_treatments) return []
    return data.first_treatments.slice(0, 10)
  }, [data])

  const finalData = useMemo(() => {
    if (!data?.final_treatments) return []
    return data.final_treatments.slice(0, 10)
  }, [data])

  const topTransition = data?.top_transitions?.[0]

  if (loading) {
    return <TreatmentPathsSkeleton />
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
          Treatment Paths
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">
          From doctor-prescribed to community-discovered
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          We tracked {data.users_with_progression.toLocaleString()} patients who discussed
          treatments over time. The pattern is clear: patients start with what their neurologist
          prescribes — triptans, verapamil, prednisone — and gradually shift toward what the
          community recommends — psilocybin, oxygen therapy, the vitamin D3 regimen.
        </p>
      </div>

      <Separator />

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-start gap-3 pt-5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Users className="size-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Progressions Tracked</span>
              <span className="text-xl font-bold">
                {data.users_with_progression.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">
                Users with treatment evolution
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-3 pt-5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Pill className="size-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Most Common Start</span>
              <span className="text-xl font-bold">
                {firstData[0]?.treatment ?? "N/A"}
              </span>
              <span className="text-xs text-muted-foreground">
                {firstData[0]?.count.toLocaleString() ?? 0} users
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-3 pt-5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <TrendingUp className="size-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Most Common End</span>
              <span className="text-xl font-bold">
                {finalData[0]?.treatment ?? "N/A"}
              </span>
              <span className="text-xs text-muted-foreground">
                {finalData[0]?.count.toLocaleString() ?? 0} users
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Side-by-side charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-blue-500" />
              First Mentioned
            </CardTitle>
            <CardDescription>
              What patients discuss when they first arrive — typically what was prescribed by their
              doctor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={firstChartConfig} className="aspect-[4/3] w-full">
              <BarChart
                data={firstData}
                layout="vertical"
                margin={{ top: 4, right: 8, bottom: 4, left: 80 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="treatment"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  width={75}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {firstData.map((_, i) => (
                    <Cell key={i} fill={FIRST_COLORS[i % FIRST_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-emerald-500" />
              Most Recent
            </CardTitle>
            <CardDescription>
              What the same patients discuss most recently — often reflecting a shift to
              community-favored treatments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={finalChartConfig} className="aspect-[4/3] w-full">
              <BarChart
                data={finalData}
                layout="vertical"
                margin={{ top: 4, right: 8, bottom: 4, left: 80 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="treatment"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  width={75}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {finalData.map((_, i) => (
                    <Cell key={i} fill={FINAL_COLORS[i % FINAL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top transitions table */}
      <Card>
        <CardHeader>
          <CardTitle>Most common treatment transitions</CardTitle>
          <CardDescription>
            The top paths patients take — from their first discussed treatment to their most
            recent. Each row represents a real journey pattern seen across multiple users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 pr-4 font-medium text-muted-foreground">From</th>
                  <th className="pb-3 px-4 font-medium text-muted-foreground" />
                  <th className="pb-3 px-4 font-medium text-muted-foreground">To</th>
                  <th className="pb-3 pl-4 text-right font-medium text-muted-foreground">
                    Patients
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.top_transitions.slice(0, 15).map((t, i) => (
                  <tr
                    key={`${t.from}-${t.to}-${i}`}
                    className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-blue-500" />
                        {t.from}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <ArrowRight className="size-4" />
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        {t.to}
                      </span>
                    </td>
                    <td className="py-3 pl-4 text-right font-medium tabular-nums">
                      {t.count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Closing context */}
      <Card className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardContent className="pt-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Why this matters:</span> The gap
            between what doctors prescribe first and what patients end up using reveals a systemic
            failure in CH treatment. {topTransition ? (
              <>
                The most common transition — {topTransition.from} to {topTransition.to} (
                {topTransition.count.toLocaleString()} patients) — reflects the community's
                collective wisdom, built through years of shared experience.
              </>
            ) : (
              <>
                Patients are finding better solutions through community knowledge sharing, not
                through their initial medical consultations.
              </>
            )} This data argues for earlier introduction of evidence-backed alternatives.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function TreatmentPathsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-16 w-2/3" />
      </div>
      <Separator />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-5">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="aspect-[4/3] w-full" />
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
          <div className="flex flex-col gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

import { useMemo } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { useDataDb } from "@/lib/data-db"

interface TreatmentToolkitData {
  users_tracked: number
  avg_initial_treatments: number
  avg_final_treatments: number
  toolkit_growth_factor: number
  first_treatments: Array<{ treatment: string; count: number }>
  full_toolkit_ranking: Array<{ treatment: string; count: number }>
  toolkit_size_distribution: Array<{ size: string; count: number }>
  top_combinations: Array<{ treatment1: string; treatment2: string; count: number }>
}

const barConfig: ChartConfig = {
  count: { label: "Patients", color: "var(--chart-1)" },
}

export function TreatmentPaths() {
  const { loading, getInsight } = useDataDb()
  const data = useMemo(
    () => (loading ? null : getInsight<TreatmentToolkitData>("treatment-paths")),
    [loading, getInsight],
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!data) {
    return <div className="py-12 text-center text-muted-foreground">No data available.</div>
  }

  return (
    <div className="flex flex-col gap-8">
      <Link to="/clusterbusters/insights" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to Insights
      </Link>

      <div>
        <h2 className="text-2xl font-bold">Treatment Toolkits</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Cluster headache patients don't switch treatments — they <strong className="text-foreground">build toolkits</strong>.
          Starting with an average of <strong className="text-foreground">{data.avg_initial_treatments} treatments</strong>,
          patients expand to <strong className="text-foreground">{data.avg_final_treatments} treatments</strong> over time —
          a <strong className="text-foreground">{data.toolkit_growth_factor}x growth</strong>.
          Oxygen, triptans, and psilocybin are combined, not substituted.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <span className="text-2xl font-bold tabular-nums text-primary">{data.users_tracked.toLocaleString()}</span>
            <span className="text-center text-xs text-muted-foreground">Patients Tracked</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <span className="text-2xl font-bold tabular-nums text-primary">{data.avg_initial_treatments}</span>
            <span className="text-center text-xs text-muted-foreground">Starting Treatments</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <span className="text-2xl font-bold tabular-nums text-primary">{data.avg_final_treatments}</span>
            <span className="text-center text-xs text-muted-foreground">Final Toolkit Size</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <span className="text-2xl font-bold tabular-nums text-primary">{data.toolkit_growth_factor}x</span>
            <span className="text-center text-xs text-muted-foreground">Growth Factor</span>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Top Combinations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Most Common Treatment Combinations</CardTitle>
          <CardDescription className="text-xs">
            Pairs of treatments used together by the same patient. These aren't switches — they're tools used in parallel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {data.top_combinations.slice(0, 10).map((combo, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold tabular-nums">
                  {i + 1}
                </span>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{combo.treatment1}</Badge>
                  <span className="text-xs text-muted-foreground">+</span>
                  <Badge variant="secondary" className="text-xs">{combo.treatment2}</Badge>
                </div>
                <span className="text-sm font-bold tabular-nums">{combo.count}</span>
                <span className="text-[0.6rem] text-muted-foreground">patients</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Toolkit Size + Full Ranking side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Toolkit Size Distribution</CardTitle>
            <CardDescription className="text-xs">
              Most patients end up with 3–6 tools in their arsenal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barConfig} className="aspect-[3/2] w-full">
              <BarChart data={data.toolkit_size_distribution} margin={{ left: 0, right: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="size" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Full Toolkit Ranking</CardTitle>
            <CardDescription className="text-xs">
              Treatments appearing most across all patient toolkits.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barConfig} style={{ height: `${Math.min(data.full_toolkit_ranking.length, 8) * 24 + 24}px` }} className="w-full">
              <BarChart data={data.full_toolkit_ranking.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 10 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="treatment" tickLine={false} axisLine={false} width={80} tick={{ fontSize: 9 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Why this matters */}
      <Card className="border-l-4 border-l-amber-500 dark:border-l-amber-400">
        <CardContent className="pt-5">
          <h3 className="text-sm font-semibold">Why this matters</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            CH treatment isn't about finding "the one thing that works" — it's about building
            a multi-tool approach. Acute abortives (oxygen, triptans, energy drinks), preventives
            (verapamil, D3), and cycle-breakers (psilocybin, seeds) each serve different roles.
            The most successful patients use 4–6 treatments in combination, not isolation.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

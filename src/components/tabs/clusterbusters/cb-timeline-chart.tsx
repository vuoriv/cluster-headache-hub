import { useMemo } from "react"
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart"
import type { TimelineData } from "@/lib/clusterbusters-types"
import { TREATMENT_COLORS } from "@/lib/clusterbusters-types"
import { TrendingUp } from "lucide-react"

const TOP_TREATMENTS: { name: string; slug: string }[] = [
  { name: "Psilocybin / Mushrooms", slug: "psilocybin-mushrooms" },
  { name: "Oxygen", slug: "oxygen" },
  { name: "RC Seeds / LSA", slug: "rc-seeds-lsa" },
  { name: "Vitamin D3 Regimen", slug: "vitamin-d3" },
  { name: "LSD", slug: "lsd" },
  { name: "Triptans", slug: "triptans" },
]

interface CbTimelineChartProps {
  timeline: TimelineData
}

export function CbTimelineChart({ timeline }: CbTimelineChartProps) {
  const { chartData, chartConfig } = useMemo(() => {
    const years = Object.keys(timeline.per_year).sort()
    const data = years.map((year) => {
      const entry: Record<string, string | number> = { year }
      for (const t of TOP_TREATMENTS) {
        entry[t.slug] = timeline.per_year[year]?.[t.name] ?? 0
      }
      return entry
    })

    const config: ChartConfig = {}
    for (const t of TOP_TREATMENTS) {
      config[t.slug] = {
        label: t.name,
        color: TREATMENT_COLORS[t.slug] ?? "var(--chart-1)",
      }
    }

    return { chartData: data, chartConfig: config }
  }, [timeline])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4 text-primary" />
          Treatment Discussion Trends Over Time
        </CardTitle>
        <CardDescription>
          Top 6 treatments by forum mention volume, 2009-2026
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
          <AreaChart data={chartData} margin={{ left: 0, right: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="year" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
            {TOP_TREATMENTS.map((t) => (
              <Area
                key={t.slug}
                dataKey={t.slug}
                type="monotone"
                fill={`var(--color-${t.slug})`}
                stroke={`var(--color-${t.slug})`}
                fillOpacity={0.15}
                stackId="a"
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

import { useMemo } from "react"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { TreatmentRanking } from "@/lib/clusterbusters-types"
import { CATEGORY_COLORS } from "@/lib/clusterbusters-types"
import { BarChart3 } from "lucide-react"

interface CbTreatmentRankingsProps {
  rankings: TreatmentRanking[]
  onNavigate: (path: string) => void
}

export function CbTreatmentRankings({ rankings, onNavigate }: CbTreatmentRankingsProps) {
  const chartData = useMemo(() =>
    rankings.map((r) => ({
      treatment: r.treatment,
      slug: r.slug,
      score: Math.round(r.composite_score * 100),
      positiveRate: Math.round(r.positive_rate * 100),
      fill: CATEGORY_COLORS[
        r.slug === "psilocybin-mushrooms" || r.slug === "rc-seeds-lsa" || r.slug === "lsd" || r.slug === "bol-148" || r.slug === "ketamine"
          ? "psychedelic"
          : r.slug === "oxygen" || r.slug === "triptans" || r.slug === "energy-drinks-caffeine"
            ? "acute"
            : r.slug === "vitamin-d3" || r.slug === "melatonin"
              ? "supportive"
              : "conventional"
      ],
    })),
    [rankings]
  )

  const chartConfig: ChartConfig = {
    score: { label: "Composite Score" },
    positiveRate: { label: "Positive Rate %" },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-4 text-primary" />
          Treatment Rankings by Composite Score
        </CardTitle>
        <CardDescription>
          Score combines mention volume and positive outcome rate across {rankings.reduce((s, r) => s + r.total_mentions, 0).toLocaleString()} forum mentions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} style={{ height: `${chartData.length * 24 + 24}px` }} className="w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="treatment"
              type="category"
              width={120}
              tickLine={false}
              axisLine={false}
              tick={({ x, y, payload }) => (
                <text
                  x={x}
                  y={y}
                  dy={4}
                  textAnchor="end"
                  className="cursor-pointer fill-muted-foreground text-[10px] sm:text-xs hover:fill-foreground"
                  onClick={() => onNavigate(chartData.find(d => d.treatment === payload.value)?.slug ?? "")}
                >
                  {payload.value}
                </text>
              )}
            />
            <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <span>{name === "score" ? "Score" : "Positive Rate"}: {String(value)}%</span>
                  )}
                />
              }
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} className="cursor-pointer" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

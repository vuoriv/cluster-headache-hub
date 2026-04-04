import { useMemo } from "react"
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart"
import type { TreatmentRanking, OutcomesMap } from "@/lib/clusterbusters-types"
import { TREATMENT_COLORS } from "@/lib/clusterbusters-types"

interface CbRadarChartProps {
  selectedSlugs: string[]
  rankings: TreatmentRanking[]
  outcomes: OutcomesMap
}

const DIMENSIONS = [
  { key: "positiveRate", label: "Positive Rate" },
  { key: "mentions", label: "Popularity" },
  { key: "compositeScore", label: "Composite Score" },
  { key: "sampleSize", label: "Sample Size" },
  { key: "lowNegative", label: "Low Negative Rate" },
]

export function CbRadarChart({ selectedSlugs, rankings, outcomes }: CbRadarChartProps) {
  const { chartData, chartConfig } = useMemo(() => {
    const selected = rankings.filter((r) => selectedSlugs.includes(r.slug))
    const maxMentions = Math.max(...rankings.map((r) => r.total_mentions))
    const maxSample = Math.max(...Object.values(outcomes).map((o) => o.rated_posts))

    const data = DIMENSIONS.map((dim) => {
      const entry: Record<string, string | number> = { dimension: dim.label }
      for (const r of selected) {
        const o = outcomes[r.treatment]
        let value = 0
        switch (dim.key) {
          case "positiveRate":
            value = r.positive_rate * 100
            break
          case "mentions":
            value = (r.total_mentions / maxMentions) * 100
            break
          case "compositeScore":
            value = r.composite_score * 100
            break
          case "sampleSize":
            value = o ? (o.rated_posts / maxSample) * 100 : 0
            break
          case "lowNegative":
            value = o ? (1 - o.negative_rate) * 100 : 50
            break
        }
        entry[r.slug] = Math.round(value)
      }
      return entry
    })

    const config: ChartConfig = {}
    for (const r of selected) {
      config[r.slug] = {
        label: r.treatment,
        color: TREATMENT_COLORS[r.slug] ?? "var(--chart-1)",
      }
    }

    return { chartData: data, chartConfig: config }
  }, [selectedSlugs, rankings, outcomes])

  if (selectedSlugs.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-[300px] items-center justify-center text-muted-foreground">
          Select treatments above to compare
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Multi-Dimensional Comparison</CardTitle>
        <CardDescription className="text-xs">
          Normalized scores across 5 dimensions (0-100 scale)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto min-h-[350px] max-w-[500px]">
          <RadarChart data={chartData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="dimension" className="text-xs" />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {selectedSlugs.map((slug) => (
              <Radar
                key={slug}
                dataKey={slug}
                fill={`var(--color-${slug})`}
                stroke={`var(--color-${slug})`}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            ))}
          </RadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

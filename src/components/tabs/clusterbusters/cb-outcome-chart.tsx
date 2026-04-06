import { useMemo } from "react"
import { Pie, PieChart, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { TreatmentProfileOutcomes } from "@/lib/clusterbusters-types"

interface CbOutcomeChartProps {
  outcomes: TreatmentProfileOutcomes
  treatmentName: string
}

const COLORS = {
  effective: "var(--chart-2)",
  partial: "var(--chart-3)",
  noEffect: "var(--chart-5)",
  other: "var(--muted-foreground)",
}

export function CbOutcomeChart({ outcomes, treatmentName }: CbOutcomeChartProps) {
  const chartData = useMemo(() => {
    const total = outcomes.effective + outcomes.partial + outcomes.noEffect
    if (total === 0) return []
    const pct = (n: number) => Math.round((n / total) * 1000) / 10
    const effPct = pct(outcomes.effective)
    const partPct = pct(outcomes.partial)
    const noEffPct = pct(outcomes.noEffect)
    return [
      { name: "Effective", value: effPct, fill: COLORS.effective },
      { name: "Partial", value: partPct, fill: COLORS.partial },
      { name: "No Effect", value: noEffPct, fill: COLORS.noEffect },
    ]
  }, [outcomes])

  const chartConfig: ChartConfig = {
    effective: { label: "Effective", color: COLORS.effective },
    partial: { label: "Partial", color: COLORS.partial },
    noEffect: { label: "No Effect", color: COLORS.noEffect },
    other: { label: "Mixed/Other", color: COLORS.other },
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Outcome Distribution</CardTitle>
        <CardDescription className="text-xs">
          Based on {outcomes.sampleSize.toLocaleString()} rated posts for {treatmentName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => <span>{String(value)}%</span>}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
          {chartData.map((entry) => (
            <span key={entry.name} className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
              {entry.name}: {entry.value}%
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

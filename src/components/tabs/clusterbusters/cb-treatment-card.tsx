import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { TreatmentRanking } from "@/lib/clusterbusters-types"

type BadgeVariant = "success" | "info" | "warning" | "purple" | "secondary"

const CATEGORY_BADGE: Record<string, { text: string; variant: BadgeVariant }> = {
  psychedelic: { text: "Psychedelic", variant: "purple" },
  acute: { text: "Acute", variant: "info" },
  conventional: { text: "Conventional", variant: "warning" },
  supportive: { text: "Supportive", variant: "success" },
}

interface CbTreatmentCardProps {
  ranking: TreatmentRanking
  category: string
  onNavigate: (path: string) => void
}

export function CbTreatmentCard({ ranking, category, onNavigate }: CbTreatmentCardProps) {
  const badge = CATEGORY_BADGE[category] ?? { text: category, variant: "secondary" as BadgeVariant }

  return (
    <Card
      className={cn(
        "cursor-pointer transition-shadow hover:shadow-md",
        "border-l-4",
        category === "psychedelic" && "border-l-[var(--chart-4)]",
        category === "acute" && "border-l-[var(--chart-1)]",
        category === "conventional" && "border-l-[var(--chart-5)]",
        category === "supportive" && "border-l-[var(--chart-2)]",
      )}
      onClick={() => onNavigate(`treatment/${ranking.slug}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{ranking.treatment}</CardTitle>
          <Badge variant={badge.variant} className="text-[0.65rem]">{badge.text}</Badge>
        </div>
        <CardDescription className="text-xs">
          {ranking.total_mentions.toLocaleString()} mentions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold tabular-nums">{Math.round(ranking.positive_rate * 100)}%</span>
            <span className="text-[0.65rem] text-muted-foreground">Positive</span>
          </div>
          <div className="flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.round(ranking.composite_score * 100)}%` }}
              />
            </div>
            <span className="text-[0.6rem] text-muted-foreground">Score: {Math.round(ranking.composite_score * 100)}/100</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

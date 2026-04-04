import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { RecommendationData } from "@/lib/clusterbusters-types"
import { Filter } from "lucide-react"

interface CbRecommendationProps {
  data: RecommendationData
  onNavigate: (path: string) => void
}

const CH_TYPE_LABELS: Record<string, string> = {
  episodic: "Episodic CH",
  chronic: "Chronic CH",
}

const CYCLE_LABELS: Record<string, string> = {
  "in-cycle": "Currently in Cycle",
  remission: "In Remission",
  "new-patient": "Newly Diagnosed",
}

const CATEGORY_BADGES: Record<string, { text: string; variant: "purple" | "info" | "warning" | "success" }> = {
  psychedelic: { text: "Psychedelic", variant: "purple" },
  acute: { text: "Acute", variant: "info" },
  conventional: { text: "Conventional", variant: "warning" },
  supportive: { text: "Supportive", variant: "success" },
}

export function CbRecommendation({ data, onNavigate }: CbRecommendationProps) {
  const [chType, setChType] = useState<string>("all")
  const [cycleStatus, setCycleStatus] = useState<string>("all")

  const filtered = useMemo(() => {
    let results = data.rankings

    if (cycleStatus === "in-cycle") {
      results = results.filter((r) => r.category === "acute" || r.category === "supportive" || r.positiveRate >= 72)
    } else if (cycleStatus === "remission") {
      results = results.filter((r) => r.category === "psychedelic" || r.category === "supportive")
    } else if (cycleStatus === "new-patient") {
      results = results.filter((r) => r.category === "acute" || r.category === "conventional" || r.category === "supportive")
    }

    if (chType === "chronic") {
      results = results.filter((r) => r.category !== "acute" || r.slug === "oxygen")
    }

    return results
  }, [data.rankings, chType, cycleStatus])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="size-4 text-primary" />
          Treatment Finder
        </CardTitle>
        <CardDescription>
          Filter community-reported treatments by your situation. Results are ranked by composite score.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <Select value={chType} onValueChange={setChType}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="CH Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {data.filters.chTypes.map((t) => (
                <SelectItem key={t} value={t}>{CH_TYPE_LABELS[t] ?? t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cycleStatus} onValueChange={setCycleStatus}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Cycle Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Status</SelectItem>
              {data.filters.cycleStatus.map((s) => (
                <SelectItem key={s} value={s}>{CYCLE_LABELS[s] ?? s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          {filtered.map((r, i) => {
            const badge = CATEGORY_BADGES[r.category]
            return (
              <div
                key={r.slug}
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                onClick={() => onNavigate(r.slug)}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold tabular-nums">
                  {i + 1}
                </span>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.positiveRate}% positive rate
                  </span>
                </div>
                {badge && <Badge variant={badge.variant} className="text-[0.6rem]">{badge.text}</Badge>}
                <div className="flex flex-col items-end gap-0.5">
                  <span className={cn("text-sm font-bold tabular-nums")}>{Math.round(r.score * 100)}</span>
                  <span className="text-[0.6rem] text-muted-foreground">score</span>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No treatments match the selected filters.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

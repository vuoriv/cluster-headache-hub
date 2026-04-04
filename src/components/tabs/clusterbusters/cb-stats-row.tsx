import { Card, CardContent } from "@/components/ui/card"
import type { ForumStats } from "@/lib/clusterbusters-types"

interface CbStatsRowProps {
  stats: ForumStats
}

export function CbStatsRow({ stats }: CbStatsRowProps) {
  const years = Object.keys(stats.posts_per_year)
  const yearSpan = years.length > 0 ? `${years[0]}\u2013${years[years.length - 1]}` : "N/A"

  const items = [
    { value: stats.total_posts_cleaned.toLocaleString(), label: "Forum Posts Analyzed" },
    { value: stats.total_topics.toLocaleString(), label: "Discussion Topics" },
    { value: yearSpan, label: "Years of Data" },
    { value: "78%", label: "Avg. Positive Rate" },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <span className="text-2xl font-bold tabular-nums text-primary">{item.value}</span>
            <span className="text-center text-xs text-muted-foreground">{item.label}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { CbRadarChart } from "./cb-radar-chart"
import { cn } from "@/lib/utils"
import { useForumDb } from "@/lib/forum-db"
import { GitCompareArrows } from "lucide-react"

interface CbCompareProps {
  onNavigate: (path: string) => void
}

export function CbCompare({ onNavigate }: CbCompareProps) {
  const { loading, error, getTreatmentRankings, getOutcomes } = useForumDb()
  const [selected, setSelected] = useState<string[]>([])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (error) {
    return <div className="py-12 text-center text-destructive">Failed to load data: {error}</div>
  }

  const rankings = getTreatmentRankings()
  const outcomes = getOutcomes()

  const toggleTreatment = (slug: string) => {
    setSelected((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug)
      if (prev.length >= 3) return prev
      return [...prev, slug]
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink className="cursor-pointer" onClick={() => onNavigate("")}>
              ClusterBusters
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Compare Treatments</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <GitCompareArrows className="size-5 text-primary" />
          Compare Treatments
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select up to 3 treatments to compare across multiple dimensions
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Select Treatments</CardTitle>
          <CardDescription className="text-xs">
            Click to select up to 3 treatments ({selected.length}/3 selected)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {rankings.map((r) => (
              <Badge
                key={r.slug}
                variant={selected.includes(r.slug) ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-colors",
                  selected.length >= 3 && !selected.includes(r.slug) && "opacity-40 cursor-not-allowed"
                )}
                onClick={() => toggleTreatment(r.slug)}
              >
                {r.treatment}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <CbRadarChart selectedSlugs={selected} rankings={rankings} outcomes={outcomes} />

      {selected.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Side-by-Side Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Metric</th>
                    {selected.map((slug) => {
                      const r = rankings.find((rk) => rk.slug === slug)
                      return (
                        <th key={slug} className="py-2 px-3 text-left text-xs font-medium">
                          <button
                            className="hover:underline"
                            onClick={() => onNavigate(slug)}
                          >
                            {r?.treatment}
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 pr-4 text-muted-foreground">Total Mentions</td>
                    {selected.map((slug) => {
                      const r = rankings.find((rk) => rk.slug === slug)
                      return <td key={slug} className="py-2 px-3 font-medium tabular-nums">{r?.total_mentions.toLocaleString()}</td>
                    })}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 text-muted-foreground">Positive Rate</td>
                    {selected.map((slug) => {
                      const r = rankings.find((rk) => rk.slug === slug)
                      return <td key={slug} className="py-2 px-3 font-medium tabular-nums">{r ? Math.round(r.positive_rate * 100) : 0}%</td>
                    })}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 text-muted-foreground">Negative Rate</td>
                    {selected.map((slug) => {
                      const o = outcomes[rankings.find((rk) => rk.slug === slug)?.treatment ?? ""]
                      return <td key={slug} className="py-2 px-3 font-medium tabular-nums">{o ? Math.round(o.negative_rate * 100) : 0}%</td>
                    })}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 text-muted-foreground">Composite Score</td>
                    {selected.map((slug) => {
                      const r = rankings.find((rk) => rk.slug === slug)
                      return <td key={slug} className="py-2 px-3 font-medium tabular-nums">{r ? Math.round(r.composite_score * 100) : 0}/100</td>
                    })}
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-muted-foreground">Sample Size</td>
                    {selected.map((slug) => {
                      const o = outcomes[rankings.find((rk) => rk.slug === slug)?.treatment ?? ""]
                      return <td key={slug} className="py-2 px-3 font-medium tabular-nums">{o?.rated_posts.toLocaleString() ?? "N/A"}</td>
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

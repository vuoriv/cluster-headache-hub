import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { CbDisclaimer } from "./cb-disclaimer"
import { CbStatsRow } from "./cb-stats-row"
import { CbTreatmentRankings } from "./cb-treatment-rankings"
import { CbTimelineChart } from "./cb-timeline-chart"
import { CbTreatmentCard } from "./cb-treatment-card"
import { useDataDb } from "@/lib/data-db"
import {
  Activity,
  BarChart3,
  ArrowRightLeft,
  Users,
  Clock,
  Heart,
  ArrowRight,
} from "lucide-react"

const INSIGHT_CARDS = [
  { slug: "patient-journeys", title: "Patient Journeys", stat: "371 returned after remission", icon: Activity, accent: "text-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400" },
  { slug: "episodic-vs-chronic", title: "Episodic vs Chronic", stat: "2,729 typed posts", icon: BarChart3, accent: "text-purple-500 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400" },
  { slug: "treatment-paths", title: "Treatment Paths", stat: "1,108 progressions", icon: ArrowRightLeft, accent: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400" },
  { slug: "demographics", title: "Community Demographics", stat: "2,749 authors", icon: Users, accent: "text-amber-500 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400" },
  { slug: "cycle-patterns", title: "Cycle Patterns", stat: "Peak: December", icon: Clock, accent: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 dark:text-cyan-400" },
  { slug: "gender-caregivers", title: "Gender & Caregivers", stat: "1,540 caregiver posts", icon: Heart, accent: "text-rose-500 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400" },
] as const

interface CbLandingProps {
  onNavigate: (path: string) => void
}

export function CbLanding({ onNavigate }: CbLandingProps) {
  const { loading, error, getForumStats, getTreatmentRankings, getTimeline } = useDataDb()

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <Skeleton className="h-8 w-80" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return <div className="py-12 text-center text-destructive">Failed to load data: {error}</div>
  }

  const stats = getForumStats()
  const rankings = getTreatmentRankings()
  const timelineData = getTimeline()

  if (!stats || !timelineData) {
    return <div className="py-12 text-center text-muted-foreground">No data available.</div>
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold">ClusterBusters Forum Analysis</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Community-reported treatment outcomes from 16+ years of forum data
        </p>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        ClusterBusters is one of the largest online communities for cluster headache patients. We analyzed{" "}
        {stats.total_posts_cleaned.toLocaleString()} forum posts across {stats.total_topics.toLocaleString()}{" "}
        topics to extract treatment mentions, sentiment, and outcome patterns. This data represents
        real-world community experience alongside the clinical trial evidence presented elsewhere on this site.
      </p>

      <CbDisclaimer onNavigate={onNavigate} />

      <CbStatsRow stats={stats} avgPositiveRate={
        rankings.length > 0
          ? Math.round(rankings.reduce((sum, r) => sum + r.positive_rate, 0) / rankings.length * 100)
          : 0
      } />

      <Separator />

      {/* Rankings + Timeline side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <CbTreatmentRankings rankings={rankings} onNavigate={onNavigate} />
        <CbTimelineChart timeline={timelineData} />
      </div>

      <Separator />

      {/* Explore Treatments */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Explore Treatments</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rankings.map((r) => (
            <CbTreatmentCard
              key={r.slug}
              ranking={r}
              category={r.category ?? "conventional"}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Community Insights */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Community Insights</h3>
          <button
            onClick={() => onNavigate("insights")}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all →
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INSIGHT_CARDS.map(({ slug, title, stat, icon: Icon, accent }) => (
            <Card
              key={slug}
              className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
              onClick={() => onNavigate(`insights/${slug}`)}
            >
              <CardContent className="flex items-center gap-3 py-3">
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold">{title}</h4>
                  <p className="text-[0.65rem] text-muted-foreground">{stat}</p>
                </div>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/40" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

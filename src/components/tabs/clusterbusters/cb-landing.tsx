import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { CbDisclaimer } from "./cb-disclaimer"
import { CbStatsRow } from "./cb-stats-row"
import { CbTreatmentRankings } from "./cb-treatment-rankings"
import { CbTimelineChart } from "./cb-timeline-chart"
import { CbTreatmentCard } from "./cb-treatment-card"
import { CbRecommendation } from "./cb-recommendation"
import { useAnalysisDb } from "@/lib/analysis-db"

interface CbLandingProps {
  onNavigate: (path: string) => void
}

const CATEGORY_FOR_SLUG: Record<string, string> = {
  "psilocybin-mushrooms": "psychedelic",
  "oxygen": "acute",
  "rc-seeds-lsa": "psychedelic",
  "vitamin-d3": "supportive",
  "lsd": "psychedelic",
  "triptans": "acute",
  "energy-drinks-caffeine": "acute",
  "prednisone-steroids": "conventional",
  "verapamil": "conventional",
  "bol-148": "psychedelic",
  "melatonin": "supportive",
  "lithium": "conventional",
  "ketamine": "psychedelic",
}

export function CbLanding({ onNavigate }: CbLandingProps) {
  const { loading, error, getForumStats, getTreatmentRankings, getTimeline, getRecommendationData } = useAnalysisDb()

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
  const recData = getRecommendationData()

  if (!stats || !timelineData || !recData) {
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

      <CbStatsRow stats={stats} />

      <Separator />

      <CbTreatmentRankings rankings={rankings} onNavigate={onNavigate} />

      <CbTimelineChart timeline={timelineData} />

      <Separator />

      <div>
        <h3 className="mb-4 text-lg font-semibold">Explore Treatments</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rankings.map((r) => (
            <CbTreatmentCard
              key={r.slug}
              ranking={r}
              category={CATEGORY_FOR_SLUG[r.slug] ?? "conventional"}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>

      <Separator />

      <CbRecommendation data={recData} onNavigate={onNavigate} />
    </div>
  )
}

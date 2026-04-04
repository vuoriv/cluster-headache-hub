import { Separator } from "@/components/ui/separator"
import { CbDisclaimer } from "./cb-disclaimer"
import { CbStatsRow } from "./cb-stats-row"
import { CbTreatmentRankings } from "./cb-treatment-rankings"
import { CbTimelineChart } from "./cb-timeline-chart"
import { CbTreatmentCard } from "./cb-treatment-card"
import { CbRecommendation } from "./cb-recommendation"
import type { ForumStats, TreatmentRanking, TimelineData, RecommendationData } from "@/lib/clusterbusters-types"

import forumStats from "@/data/forum-stats.json"
import treatmentRankings from "@/data/treatment-rankings.json"
import timeline from "@/data/timeline.json"
import recommendationData from "@/data/recommendation-data.json"

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
  const stats = forumStats as ForumStats
  const rankings = treatmentRankings as TreatmentRanking[]
  const timelineData = timeline as TimelineData
  const recData = recommendationData as RecommendationData

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

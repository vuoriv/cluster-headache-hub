export interface ForumStats {
  total_posts_raw: number
  total_posts_cleaned: number
  total_topics: number
  date_range: {
    earliest: string
    latest: string
  }
  forum_breakdown: Record<string, number>
  posts_per_year: Record<string, number>
}

export interface TreatmentRanking {
  treatment: string
  slug: string
  total_mentions: number
  positive_rate: number
  normalized_mentions: number
  composite_score: number
}

export interface TimelineData {
  per_year: Record<string, Record<string, number>>
  per_forum: Record<string, Record<string, number>>
}

export interface OutcomeData {
  total_mentions: number
  rated_posts: number
  positive: number
  negative: number
  partial: number
  neutral: number
  mixed: number
  positive_rate: number
  negative_rate: number
  partial_rate: number
}

export type OutcomesMap = Record<string, OutcomeData>

export type CoOccurrenceMap = Record<string, Record<string, number>>

export interface RecommendationFilter {
  slug: string
  name: string
}

export interface RecommendationRanking {
  slug: string
  name: string
  category: string
  positiveRate: number
  score: number
}

export interface RecommendationData {
  filters: {
    chTypes: string[]
    cycleStatus: string[]
    treatments: RecommendationFilter[]
  }
  rankings: RecommendationRanking[]
}

export interface TreatmentProfileStats {
  mentions: number
  positiveRate: number
  peakYear: number
  score: number
}

export interface TreatmentProfileOutcomes {
  effective: number
  partial: number
  noEffect: number
  sampleSize: number
}

export interface TreatmentProfileTimeline {
  year: number
  mentions: number
}

export interface TreatmentProfile {
  slug: string
  name: string
  category: string
  stats: TreatmentProfileStats
  protocol: {
    dosing: string[]
    preparations: string[]
    schedule: string[]
  }
  outcomes: TreatmentProfileOutcomes
  timeline: TreatmentProfileTimeline[]
  sideEffects: string[]
  contraindications: string[]
  coTreatments: string[]
  sampleSize: number
}

export const CATEGORY_COLORS: Record<string, string> = {
  psychedelic: "var(--chart-4)",
  acute: "var(--chart-1)",
  conventional: "var(--chart-5)",
  supportive: "var(--chart-2)",
}

export const TREATMENT_COLORS: Record<string, string> = {
  "psilocybin-mushrooms": "var(--chart-4)",
  oxygen: "var(--chart-1)",
  "rc-seeds-lsa": "var(--chart-6)",
  "vitamin-d3": "var(--chart-2)",
  lsd: "var(--chart-7)",
  triptans: "var(--chart-3)",
  "energy-drinks-caffeine": "var(--chart-8)",
  "prednisone-steroids": "var(--chart-5)",
  verapamil: "var(--chart-9)",
  "bol-148": "var(--chart-10)",
  melatonin: "var(--chart-2)",
  lithium: "var(--chart-1)",
  ketamine: "var(--chart-3)",
}

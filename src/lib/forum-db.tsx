import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import initSqlJs, { type Database } from "sql.js"
import type {
  ForumStats,
  TreatmentRanking,
  TimelineData,
  OutcomeData,
  OutcomesMap,
  CoOccurrenceMap,
  RecommendationData,
  TreatmentProfile,
} from "./clusterbusters-types"

interface ForumDbContextValue {
  loading: boolean
  error: string | null
  getForumStats: () => ForumStats | null
  getTreatmentRankings: () => TreatmentRanking[]
  getTimeline: () => TimelineData | null
  getOutcomes: () => OutcomesMap
  getOutcomeByName: (treatmentName: string) => OutcomeData | null
  getCoOccurrence: () => CoOccurrenceMap
  getTreatmentProfile: (slug: string) => TreatmentProfile | null
  getRecommendationData: () => RecommendationData | null
}

const ForumDbContext = createContext<ForumDbContextValue | null>(null)

export function ForumDbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const base = import.meta.env.BASE_URL
    const wasmUrl = `${base}sql-wasm.wasm`
    const dbUrl = `${base}analysis.db`

    async function load() {
      try {
        const SQL = await initSqlJs({ locateFile: () => wasmUrl })
        const response = await fetch(dbUrl)
        if (!response.ok) throw new Error(`Failed to fetch analysis.db: ${response.status}`)
        const buffer = await response.arrayBuffer()
        const database = new SQL.Database(new Uint8Array(buffer))
        setDb(database)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load database")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const getForumStats = useCallback((): ForumStats | null => {
    if (!db) return null
    const rows = db.exec("SELECT key, value FROM forum_stats")
    if (rows.length === 0) return null
    const obj: Record<string, unknown> = {}
    for (const row of rows[0].values) {
      obj[row[0] as string] = JSON.parse(row[1] as string)
    }
    return obj as unknown as ForumStats
  }, [db])

  const getTreatmentRankings = useCallback((): TreatmentRanking[] => {
    if (!db) return []
    const rows = db.exec(
      "SELECT slug, name, category, total_mentions, positive_rate, normalized_mentions, composite_score FROM treatment_rankings ORDER BY composite_score DESC"
    )
    if (rows.length === 0) return []
    return rows[0].values.map((row) => ({
      treatment: row[1] as string,
      slug: row[0] as string,
      total_mentions: row[3] as number,
      positive_rate: row[4] as number,
      normalized_mentions: row[5] as number,
      composite_score: row[6] as number,
    }))
  }, [db])

  const getTimeline = useCallback((): TimelineData | null => {
    if (!db) return null
    const rows = db.exec("SELECT year, treatment_name, mentions FROM timeline ORDER BY year")
    if (rows.length === 0) return null

    const perYear: Record<string, Record<string, number>> = {}
    for (const row of rows[0].values) {
      const year = String(row[0])
      const treatment = row[1] as string
      const mentions = row[2] as number
      if (!perYear[year]) perYear[year] = {}
      perYear[year][treatment] = mentions
    }

    return { per_year: perYear, per_forum: {} } as TimelineData
  }, [db])

  const getOutcomes = useCallback((): OutcomesMap => {
    if (!db) return {}
    const rows = db.exec(
      "SELECT treatment_name, total_mentions, rated_posts, positive, negative, partial, neutral, mixed, positive_rate, negative_rate, partial_rate FROM outcomes"
    )
    if (rows.length === 0) return {}
    const map: OutcomesMap = {}
    for (const row of rows[0].values) {
      map[row[0] as string] = {
        total_mentions: row[1] as number,
        rated_posts: row[2] as number,
        positive: row[3] as number,
        negative: row[4] as number,
        partial: row[5] as number,
        neutral: row[6] as number,
        mixed: row[7] as number,
        positive_rate: row[8] as number,
        negative_rate: row[9] as number,
        partial_rate: row[10] as number,
      }
    }
    return map
  }, [db])

  const getOutcomeByName = useCallback(
    (treatmentName: string): OutcomeData | null => {
      if (!db) return null
      const stmt = db.prepare("SELECT total_mentions, rated_posts, positive, negative, partial, neutral, mixed, positive_rate, negative_rate, partial_rate FROM outcomes WHERE treatment_name = ?")
      stmt.bind([treatmentName])
      if (!stmt.step()) {
        stmt.free()
        return null
      }
      const row = stmt.get()
      stmt.free()
      return {
        total_mentions: row[0] as number,
        rated_posts: row[1] as number,
        positive: row[2] as number,
        negative: row[3] as number,
        partial: row[4] as number,
        neutral: row[5] as number,
        mixed: row[6] as number,
        positive_rate: row[7] as number,
        negative_rate: row[8] as number,
        partial_rate: row[9] as number,
      }
    },
    [db]
  )

  const getCoOccurrence = useCallback((): CoOccurrenceMap => {
    if (!db) return {}
    const rows = db.exec("SELECT treatment1, treatment2, count FROM co_occurrence")
    if (rows.length === 0) return {}
    const map: CoOccurrenceMap = {}
    for (const row of rows[0].values) {
      const t1 = row[0] as string
      const t2 = row[1] as string
      const count = row[2] as number
      if (!map[t1]) map[t1] = {}
      map[t1][t2] = count
    }
    return map
  }, [db])

  const getTreatmentProfile = useCallback(
    (slug: string): TreatmentProfile | null => {
      if (!db) return null
      const stmt = db.prepare("SELECT data FROM treatment_profiles WHERE slug = ?")
      stmt.bind([slug])
      if (!stmt.step()) {
        stmt.free()
        return null
      }
      const row = stmt.get()
      stmt.free()
      return JSON.parse(row[0] as string) as TreatmentProfile
    },
    [db]
  )

  const getRecommendationData = useCallback((): RecommendationData | null => {
    if (!db) return null
    const rows = db.exec("SELECT key, value FROM recommendation_data")
    if (rows.length === 0) return null
    const obj: Record<string, unknown> = {}
    for (const row of rows[0].values) {
      obj[row[0] as string] = JSON.parse(row[1] as string)
    }
    return obj as unknown as RecommendationData
  }, [db])

  const value: ForumDbContextValue = {
    loading,
    error,
    getForumStats,
    getTreatmentRankings,
    getTimeline,
    getOutcomes,
    getOutcomeByName,
    getCoOccurrence,
    getTreatmentProfile,
    getRecommendationData,
  }

  return <ForumDbContext.Provider value={value}>{children}</ForumDbContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useForumDb(): ForumDbContextValue {
  const ctx = useContext(ForumDbContext)
  if (!ctx) {
    throw new Error("useForumDb must be used within a ForumDbProvider")
  }
  return ctx
}

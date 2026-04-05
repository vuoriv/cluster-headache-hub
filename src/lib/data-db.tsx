import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import initSqlJs, { type Database, type SqlValue } from "sql.js"
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

// ── Research types ──

export interface ResearchTrial {
  nctId: string
  title: string
  status: string
  phase: string[]
  studyType: string
  sponsor: string
  enrollment: number | null
  startDate: string
  endDate: string
  interventions: string[]
  summary: string
  conditions: string
  category: string
  relevanceScore: number
}

export interface ResearchPaper {
  pmid: string
  title: string
  authors: string
  journal: string
  pubDate: string
  abstract: string
  meshTerms: string[]
  category: string
  relevanceScore: number
}

export interface PipelineMeta {
  lastRun: string
  trialCount: number
  paperCount: number
  trialCategories: Record<string, number>
  paperCategories: Record<string, number>
}

export interface ResearchSearchParams {
  query?: string
  category?: string
  yearFrom?: number
  yearTo?: number
  limit?: number
  offset?: number
}

export interface TrialSearchParams {
  query?: string
  status?: string
  phase?: string
  category?: string
}

// ── Combined context ──

interface DataDbContextValue {
  loading: boolean
  error: string | null

  // Forum analysis (ClusterBusters)
  getForumStats: () => ForumStats | null
  getTreatmentRankings: () => TreatmentRanking[]
  getTimeline: () => TimelineData | null
  getOutcomes: () => OutcomesMap
  getOutcomeByName: (treatmentName: string) => OutcomeData | null
  getCoOccurrence: () => CoOccurrenceMap
  getTreatmentProfile: (slug: string) => TreatmentProfile | null
  getRecommendationData: () => RecommendationData | null

  // Research (trials + papers)
  searchPapers: (params: ResearchSearchParams) => ResearchPaper[]
  searchTrials: (params: TrialSearchParams) => ResearchTrial[]
  getActiveTrials: () => ResearchTrial[]
  getTrial: (nctId: string) => ResearchTrial | null
  getPaper: (pmid: string) => ResearchPaper | null
  getMeta: () => PipelineMeta | null
  getCategories: () => string[]

  // Insights
  getInsight: <T = unknown>(slug: string) => T | null
  getTopAuthors: (limit?: number) => string[]
}

const DataDbContext = createContext<DataDbContextValue | null>(null)

// ── Helpers ──

function parseJsonSafe<T>(json: string | null, fallback: T): T {
  if (!json) return fallback
  try {
    return JSON.parse(json)
  } catch {
    return fallback
  }
}

function mapTrial(row: unknown[]): ResearchTrial {
  return {
    nctId: row[0] as string,
    title: row[1] as string,
    status: row[2] as string,
    phase: parseJsonSafe(row[3] as string, []),
    studyType: row[4] as string,
    sponsor: row[5] as string,
    enrollment: row[6] as number | null,
    startDate: row[7] as string,
    endDate: row[8] as string,
    interventions: parseJsonSafe(row[9] as string, []),
    summary: row[10] as string,
    conditions: row[11] as string,
    category: row[12] as string,
    relevanceScore: row[13] as number,
  }
}

function mapPaper(row: unknown[]): ResearchPaper {
  return {
    pmid: row[0] as string,
    title: row[1] as string,
    authors: row[2] as string,
    journal: row[3] as string,
    pubDate: row[4] as string,
    abstract: row[5] as string,
    meshTerms: parseJsonSafe(row[6] as string, []),
    category: row[7] as string,
    relevanceScore: row[8] as number,
  }
}

// ── Provider ──

export function DataDbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)
  const dbRef = useRef<Database | null>(null)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const base = import.meta.env.BASE_URL
    const wasmUrl = `${base}sql-wasm.wasm`
    const dbUrl = `${base}data.db`

    async function load() {
      try {
        const SQL = await initSqlJs({ locateFile: () => wasmUrl })
        const response = await fetch(dbUrl)
        if (!response.ok)
          throw new Error(`Failed to fetch data.db: ${response.status}`)
        const buffer = await response.arrayBuffer()
        const database = new SQL.Database(new Uint8Array(buffer))
        dbRef.current = database
        setDb(database)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load database")
      } finally {
        setLoading(false)
      }
    }

    load()

    return () => {
      if (dbRef.current) {
        dbRef.current.close()
        dbRef.current = null
        setDb(null)
      }
    }
  }, [])

  // ── Forum analysis queries ──

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
      "SELECT slug, name, category, total_mentions, positive_rate, normalized_mentions, composite_score FROM treatment_rankings ORDER BY composite_score DESC",
    )
    if (rows.length === 0) return []
    return rows[0].values.map((row) => ({
      treatment: row[1] as string,
      slug: row[0] as string,
      category: row[2] as string,
      total_mentions: row[3] as number,
      positive_rate: row[4] as number,
      normalized_mentions: row[5] as number,
      composite_score: row[6] as number,
    }))
  }, [db])

  const getTimeline = useCallback((): TimelineData | null => {
    if (!db) return null
    const rows = db.exec(
      "SELECT year, treatment_name, mentions FROM timeline ORDER BY year",
    )
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
      "SELECT treatment_name, total_mentions, rated_posts, positive, negative, partial, neutral, mixed, positive_rate, negative_rate, partial_rate FROM outcomes",
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
      const stmt = db.prepare(
        "SELECT total_mentions, rated_posts, positive, negative, partial, neutral, mixed, positive_rate, negative_rate, partial_rate FROM outcomes WHERE treatment_name = ?",
      )
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
    [db],
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
      const stmt = db.prepare(
        "SELECT data FROM treatment_profiles WHERE slug = ?",
      )
      stmt.bind([slug])
      if (!stmt.step()) {
        stmt.free()
        return null
      }
      const row = stmt.get()
      stmt.free()
      return JSON.parse(row[0] as string) as TreatmentProfile
    },
    [db],
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

  // ── Research queries ──

  const searchPapers = useCallback(
    (params: ResearchSearchParams): ResearchPaper[] => {
      if (!db) return []
      let sql =
        "SELECT pmid, title, authors, journal, pub_date, abstract, mesh_terms, category, relevance_score FROM papers WHERE 1=1"
      const binds: SqlValue[] = []

      if (params.query) {
        sql += " AND (title LIKE ? OR abstract LIKE ? OR authors LIKE ?)"
        const q = `%${params.query}%`
        binds.push(q, q, q)
      }
      if (params.category) {
        sql += " AND category = ?"
        binds.push(params.category)
      }
      if (params.yearFrom) {
        sql += " AND CAST(substr(pub_date, 1, 4) AS INTEGER) >= ?"
        binds.push(params.yearFrom)
      }
      if (params.yearTo) {
        sql += " AND CAST(substr(pub_date, 1, 4) AS INTEGER) <= ?"
        binds.push(params.yearTo)
      }

      sql += " ORDER BY relevance_score DESC, pub_date DESC"
      const limit = Math.max(1, Math.min(200, Math.floor(Number(params.limit) || 50)))
      const offset = Math.max(0, Math.floor(Number(params.offset) || 0))
      sql += " LIMIT ? OFFSET ?"
      binds.push(limit, offset)

      const stmt = db.prepare(sql)
      stmt.bind(binds)

      const results: ResearchPaper[] = []
      while (stmt.step()) {
        results.push(mapPaper(stmt.get()))
      }
      stmt.free()
      return results
    },
    [db],
  )

  const searchTrials = useCallback(
    (params: TrialSearchParams): ResearchTrial[] => {
      if (!db) return []
      let sql =
        "SELECT nct_id, title, status, phase, study_type, sponsor, enrollment, start_date, end_date, interventions, summary, conditions, category, relevance_score FROM trials WHERE 1=1"
      const binds: SqlValue[] = []

      if (params.query) {
        sql += " AND (title LIKE ? OR summary LIKE ? OR interventions LIKE ?)"
        const q = `%${params.query}%`
        binds.push(q, q, q)
      }
      if (params.status) {
        sql += " AND status = ?"
        binds.push(params.status)
      }
      if (params.phase) {
        sql += " AND phase LIKE ?"
        binds.push(`%${params.phase}%`)
      }
      if (params.category) {
        sql += " AND category = ?"
        binds.push(params.category)
      }

      sql += " ORDER BY relevance_score DESC"

      const stmt = db.prepare(sql)
      stmt.bind(binds)

      const results: ResearchTrial[] = []
      while (stmt.step()) {
        results.push(mapTrial(stmt.get()))
      }
      stmt.free()
      return results
    },
    [db],
  )

  const getActiveTrials = useCallback((): ResearchTrial[] => {
    if (!db) return []
    const rows = db.exec(
      "SELECT nct_id, title, status, phase, study_type, sponsor, enrollment, start_date, end_date, interventions, summary, conditions, category, relevance_score FROM trials WHERE status IN ('RECRUITING', 'NOT_YET_RECRUITING', 'ACTIVE_NOT_RECRUITING') ORDER BY relevance_score DESC",
    )
    if (rows.length === 0) return []
    return rows[0].values.map(mapTrial)
  }, [db])

  const getTrial = useCallback(
    (nctId: string): ResearchTrial | null => {
      if (!db) return null
      const stmt = db.prepare(
        "SELECT nct_id, title, status, phase, study_type, sponsor, enrollment, start_date, end_date, interventions, summary, conditions, category, relevance_score FROM trials WHERE nct_id = ?",
      )
      stmt.bind([nctId])
      if (!stmt.step()) {
        stmt.free()
        return null
      }
      const result = mapTrial(stmt.get())
      stmt.free()
      return result
    },
    [db],
  )

  const getPaper = useCallback(
    (pmid: string): ResearchPaper | null => {
      if (!db) return null
      const stmt = db.prepare(
        "SELECT pmid, title, authors, journal, pub_date, abstract, mesh_terms, category, relevance_score FROM papers WHERE pmid = ?",
      )
      stmt.bind([pmid])
      if (!stmt.step()) {
        stmt.free()
        return null
      }
      const result = mapPaper(stmt.get())
      stmt.free()
      return result
    },
    [db],
  )

  const getMeta = useCallback((): PipelineMeta | null => {
    if (!db) return null
    const rows = db.exec("SELECT key, value FROM pipeline_meta")
    if (rows.length === 0) return null
    const obj: Record<string, string> = {}
    for (const row of rows[0].values) {
      obj[row[0] as string] = row[1] as string
    }
    return {
      lastRun: obj.last_run || "",
      trialCount: parseInt(obj.trial_count) || 0,
      paperCount: parseInt(obj.paper_count) || 0,
      trialCategories: parseJsonSafe(obj.trial_categories, {}),
      paperCategories: parseJsonSafe(obj.paper_categories, {}),
    }
  }, [db])

  const getCategories = useCallback((): string[] => {
    if (!db) return []
    const rows = db.exec(
      "SELECT DISTINCT category FROM trials UNION SELECT DISTINCT category FROM papers ORDER BY category",
    )
    if (rows.length === 0) return []
    return rows[0].values.map((r) => r[0] as string)
  }, [db])

  const getTopAuthors = useCallback(
    (limit = 100): string[] => {
      if (!db) return []
      const rows = db.exec(
        `SELECT DISTINCT substr(authors, 1, instr(authors || ',', ',') - 1) as first_author, COUNT(*) as cnt
         FROM papers WHERE authors IS NOT NULL AND authors != ''
         GROUP BY first_author HAVING cnt >= 3
         ORDER BY cnt DESC LIMIT ${limit}`,
      )
      if (rows.length === 0) return []
      return rows[0].values.map((r) => r[0] as string).filter(Boolean)
    },
    [db],
  )

  const getInsight = useCallback(
    <T = unknown>(slug: string): T | null => {
      if (!db) return null
      const stmt = db.prepare("SELECT data FROM insights WHERE slug = ?")
      stmt.bind([slug])
      if (!stmt.step()) {
        stmt.free()
        return null
      }
      const row = stmt.get()
      stmt.free()
      return JSON.parse(row[0] as string) as T
    },
    [db],
  )

  const value: DataDbContextValue = {
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
    searchPapers,
    searchTrials,
    getActiveTrials,
    getTrial,
    getPaper,
    getMeta,
    getCategories,
    getInsight,
    getTopAuthors,
  }

  return <DataDbContext.Provider value={value}>{children}</DataDbContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDataDb(): DataDbContextValue {
  const ctx = useContext(DataDbContext)
  if (!ctx) {
    throw new Error("useDataDb must be used within a DataDbProvider")
  }
  return ctx
}

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
  abstractStructured: Record<string, string> | null
  meshTerms: string[]
  authorKeywords: string[]
  affiliations: string[]
  doi: string | null
  pmcid: string | null
  fullTextSections: Record<string, string> | null
  nctIdsCited: string[]
  isOa: boolean
  oaUrl: string | null
  oaStatus: string | null
  category: string
  relevanceScore: number
}

export interface PaperAnalysis {
  pmid: string
  outcome: string
  plainSummary: string | null
  keyFinding: string | null
  sampleSize: number | null
  studyType: string
  evidenceTier: number
  interventionsStudied: string[]
  analysisSource: string
}

export interface TrialAnalysis {
  nctId: string
  whatTested: string | null
  keyResult: string | null
  verdict: string
  patientRelevance: string | null
  doseTested: string | null
  sampleSize: number | null
}

export interface PaperTrialLink {
  pmid: string
  nctId: string
  linkType: "confirmed" | "related"
}

export interface CategoryStats {
  category: string
  paperCount: number
  trialCount: number
  activeTrialCount: number
  positiveOutcomeCount: number
  avgEvidenceTier: number
  oaRate: number
  papersLinkedToTrials: number
  topAuthors: Array<{ name: string; count: number }>
  topInstitutions: Array<{ name: string; count: number }>
  papersPerYear: Record<string, number>
  studyTypeDistribution: Array<{ type: string; count: number }>
  resultDistribution: Array<{ result: string; count: number }>
}

export interface Subcategory {
  term: string
  paperCount: number
  trialCount: number
  searchTerms: string[]
}

export interface PipelineRun {
  runId: string
  startedAt: string
  finishedAt: string | null
  status: "running" | "success" | "failure"
  errorMessage: string | null
  phasesCompleted: string[]
  papersAnalyzed: number
  trialsAnalyzed: number
  forumPostsAnalyzed: number
  trigger: string
  log: string
}

export interface AnalysisCoverage {
  totalPapers: number
  aiAnalyzed: number
  regexOnly: number
  errorCount: number
  totalTrials: number
  aiTrials: number
}

export interface AnalysisError {
  id: string
  error: string
  timestamp: string
  retryCount: number
}

export interface DataFreshness {
  newestPaperDate: string | null
  newestTrialDate: string | null
  lastRunAt: string | null
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

  // Analyses & links
  getPaperAnalysis: (pmid: string) => PaperAnalysis | null
  getTrialAnalysis: (nctId: string) => TrialAnalysis | null
  getLinkedPapers: (nctId: string) => Array<ResearchPaper & { linkType: string }>
  getLinkedTrials: (pmid: string) => Array<ResearchTrial & { linkType: string }>
  getCategoryStats: (category: string) => CategoryStats | null
  getSubcategories: (category: string) => Subcategory[]
  getResearchStats: () => Record<string, unknown>

  // Community
  getCommunityGroups: () => CommunityGroup[]

  // Diagnostics
  getPipelineRuns: () => PipelineRun[]
  getAnalysisCoverage: () => AnalysisCoverage
  getAnalysisErrors: () => AnalysisError[]
  getDataFreshness: () => DataFreshness
}

export interface CommunityGroup {
  name: string
  country: string
  region: string
  platform: string
  url: string
  language: string
  description: string
  members: string | null
  tags: string[]
  contactEmail: string | null
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
    abstractStructured: parseJsonSafe(row[6] as string, null),
    meshTerms: parseJsonSafe(row[7] as string, []),
    authorKeywords: parseJsonSafe(row[8] as string, []),
    affiliations: parseJsonSafe(row[9] as string, []),
    doi: row[10] as string | null,
    pmcid: row[11] as string | null,
    fullTextSections: parseJsonSafe(row[12] as string, null),
    nctIdsCited: parseJsonSafe(row[13] as string, []),
    isOa: (row[14] as number) === 1,
    oaUrl: row[15] as string | null,
    oaStatus: row[16] as string | null,
    category: row[17] as string,
    relevanceScore: row[18] as number,
  }
}

// ── Provider ──

export function DataDbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const dbRef = useRef<Database | null>(null)

  useEffect(() => {
    let cancelled = false

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
        if (cancelled) return
        const database = new SQL.Database(new Uint8Array(buffer))
        dbRef.current = database
        setDb(database)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load database")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
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
    const rows = db.exec("SELECT key, value FROM cb_forum_stats")
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
      "SELECT slug, name, category, total_mentions, positive_rate, normalized_mentions, composite_score FROM cb_treatment_rankings ORDER BY composite_score DESC",
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
      "SELECT year, treatment_name, mentions FROM cb_timeline ORDER BY year",
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
      "SELECT treatment_name, total_mentions, rated_posts, positive, negative, partial, neutral, mixed, positive_rate, negative_rate, partial_rate FROM cb_outcomes",
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
        "SELECT total_mentions, rated_posts, positive, negative, partial, neutral, mixed, positive_rate, negative_rate, partial_rate FROM cb_outcomes WHERE treatment_name = ?",
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
    const rows = db.exec("SELECT treatment1, treatment2, count FROM cb_co_occurrence")
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
        "SELECT data FROM cb_treatment_profiles WHERE slug = ?",
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
    const rows = db.exec("SELECT key, value FROM cb_recommendation_data")
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
        "SELECT pmid, title, authors, journal, pub_date, abstract, abstract_structured, mesh_terms, author_keywords, affiliations, doi, pmcid, full_text_sections, nct_ids_cited, is_oa, oa_url, oa_status, category, relevance_score FROM pa_papers WHERE 1=1"
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
        "SELECT nct_id, title, status, phase, study_type, sponsor, enrollment, start_date, end_date, interventions, summary, conditions, category, relevance_score FROM tr_trials WHERE 1=1"
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
      "SELECT nct_id, title, status, phase, study_type, sponsor, enrollment, start_date, end_date, interventions, summary, conditions, category, relevance_score FROM tr_trials WHERE status IN ('RECRUITING', 'NOT_YET_RECRUITING', 'ACTIVE_NOT_RECRUITING') ORDER BY relevance_score DESC",
    )
    if (rows.length === 0) return []
    return rows[0].values.map(mapTrial)
  }, [db])

  const getTrial = useCallback(
    (nctId: string): ResearchTrial | null => {
      if (!db) return null
      const stmt = db.prepare(
        "SELECT nct_id, title, status, phase, study_type, sponsor, enrollment, start_date, end_date, interventions, summary, conditions, category, relevance_score FROM tr_trials WHERE nct_id = ?",
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
        "SELECT pmid, title, authors, journal, pub_date, abstract, abstract_structured, mesh_terms, author_keywords, affiliations, doi, pmcid, full_text_sections, nct_ids_cited, is_oa, oa_url, oa_status, category, relevance_score FROM pa_papers WHERE pmid = ?",
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
    const rows = db.exec("SELECT key, value FROM rs_stats")
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
      "SELECT DISTINCT category FROM tr_trials UNION SELECT DISTINCT category FROM pa_papers ORDER BY category",
    )
    if (rows.length === 0) return []
    return rows[0].values.map((r) => r[0] as string)
  }, [db])

  const getTopAuthors = useCallback(
    (limit = 100): string[] => {
      if (!db) return []
      const rows = db.exec(
        `SELECT DISTINCT substr(authors, 1, instr(authors || ',', ',') - 1) as first_author, COUNT(*) as cnt
         FROM pa_papers WHERE authors IS NOT NULL AND authors != ''
         GROUP BY first_author HAVING cnt >= 3
         ORDER BY cnt DESC LIMIT ${limit}`,
      )
      if (rows.length === 0) return []
      return rows[0].values.map((r) => r[0] as string).filter(Boolean)
    },
    [db],
  )

  const getCommunityGroups = useCallback((): CommunityGroup[] => {
    if (!db) return []
    const rows = db.exec(
      "SELECT name, country, region, platform, url, language, description, members, tags, contact_email FROM co_groups ORDER BY region, country, name",
    )
    if (rows.length === 0) return []
    return rows[0].values.map((r) => ({
      name: r[0] as string,
      country: r[1] as string,
      region: r[2] as string,
      platform: r[3] as string,
      url: r[4] as string,
      language: r[5] as string,
      description: r[6] as string,
      members: r[7] as string | null,
      tags: parseJsonSafe(r[8] as string, []),
      contactEmail: r[9] as string | null,
    }))
  }, [db])

  const getInsight = useCallback(
    <T = unknown>(slug: string): T | null => {
      if (!db) return null
      const stmt = db.prepare("SELECT data FROM cb_insights WHERE slug = ?")
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

  const getPaperAnalysis = useCallback(
    (pmid: string): PaperAnalysis | null => {
      if (!db) return null
      try {
        const stmt = db.prepare(
          "SELECT pmid, study_type, result, sample_size, evidence_tier, analysis_source FROM pa_analyses WHERE pmid = ?",
        )
        stmt.bind([pmid])
        if (!stmt.step()) {
          stmt.free()
          return null
        }
        const row = stmt.get()
        stmt.free()
        return {
          pmid: row[0] as string,
          outcome: row[2] as string,
          plainSummary: null,
          keyFinding: null,
          sampleSize: row[3] as number | null,
          studyType: row[1] as string,
          evidenceTier: row[4] as number,
          interventionsStudied: [],
          analysisSource: row[5] as string,
        }
      } catch {
        return null
      }
    },
    [db],
  )

  const getTrialAnalysis = useCallback(
    (nctId: string): TrialAnalysis | null => {
      if (!db) return null
      try {
        const stmt = db.prepare(
          "SELECT nct_id, what_tested, key_result, verdict, patient_relevance, dose_tested, sample_size FROM tr_analyses WHERE nct_id = ?",
        )
        stmt.bind([nctId])
        if (!stmt.step()) {
          stmt.free()
          return null
        }
        const row = stmt.get()
        stmt.free()
        return {
          nctId: row[0] as string,
          whatTested: row[1] as string | null,
          keyResult: row[2] as string | null,
          verdict: row[3] as string,
          patientRelevance: row[4] as string | null,
          doseTested: row[5] as string | null,
          sampleSize: row[6] as number | null,
        }
      } catch {
        return null
      }
    },
    [db],
  )

  const getLinkedPapers = useCallback(
    (nctId: string): Array<ResearchPaper & { linkType: string }> => {
      if (!db) return []
      try {
        const stmt = db.prepare(
          "SELECT p.pmid, p.title, p.authors, p.journal, p.pub_date, p.abstract, p.abstract_structured, p.mesh_terms, p.author_keywords, p.affiliations, p.doi, p.pmcid, p.full_text_sections, p.nct_ids_cited, p.is_oa, p.oa_url, p.oa_status, p.category, p.relevance_score, l.link_type FROM pa_papers p JOIN rs_paper_trial_links l ON p.pmid = l.pmid WHERE l.nct_id = ? ORDER BY l.link_type, p.pub_date DESC",
        )
        stmt.bind([nctId])
        const results: Array<ResearchPaper & { linkType: string }> = []
        while (stmt.step()) {
          const row = stmt.get()
          results.push({
            ...mapPaper(row),
            linkType: row[19] as string,
          })
        }
        stmt.free()
        return results
      } catch {
        return []
      }
    },
    [db],
  )

  const getLinkedTrials = useCallback(
    (pmid: string): Array<ResearchTrial & { linkType: string }> => {
      if (!db) return []
      try {
        const stmt = db.prepare(
          "SELECT t.nct_id, t.title, t.status, t.phase, t.study_type, t.sponsor, t.enrollment, t.start_date, t.end_date, t.interventions, t.summary, t.conditions, t.category, t.relevance_score, l.link_type FROM tr_trials t JOIN rs_paper_trial_links l ON t.nct_id = l.nct_id WHERE l.pmid = ? ORDER BY l.link_type",
        )
        stmt.bind([pmid])
        const results: Array<ResearchTrial & { linkType: string }> = []
        while (stmt.step()) {
          const row = stmt.get()
          results.push({
            ...mapTrial(row),
            linkType: row[14] as string,
          })
        }
        stmt.free()
        return results
      } catch {
        return []
      }
    },
    [db],
  )

  const getCategoryStats = useCallback(
    (category: string): CategoryStats | null => {
      if (!db) return null
      try {
        const stmt = db.prepare(
          "SELECT category, paper_count, trial_count, active_trial_count, positive_outcome_count, avg_evidence_tier, oa_rate, papers_linked_to_trials, top_authors, top_institutions, papers_per_year, study_type_distribution, result_distribution FROM rs_category_stats WHERE category = ?",
        )
        stmt.bind([category])
        if (!stmt.step()) {
          stmt.free()
          return null
        }
        const row = stmt.get()
        stmt.free()
        return {
          category: row[0] as string,
          paperCount: row[1] as number,
          trialCount: row[2] as number,
          activeTrialCount: row[3] as number,
          positiveOutcomeCount: row[4] as number,
          avgEvidenceTier: row[5] as number,
          oaRate: row[6] as number,
          papersLinkedToTrials: row[7] as number,
          topAuthors: parseJsonSafe(row[8] as string, []),
          topInstitutions: parseJsonSafe(row[9] as string, []),
          papersPerYear: parseJsonSafe(row[10] as string, {}),
          studyTypeDistribution: parseJsonSafe(row[11] as string, []),
          resultDistribution: parseJsonSafe(row[12] as string, []),
        }
      } catch {
        return null
      }
    },
    [db],
  )

  const getSubcategories = useCallback(
    (category: string): Subcategory[] => {
      if (!db) return []
      try {
        const stmt = db.prepare(
          "SELECT term, paper_count, trial_count, search_terms FROM rs_subcategories WHERE category = ? ORDER BY (paper_count + trial_count) DESC"
        )
        stmt.bind([category])
        const results: Subcategory[] = []
        while (stmt.step()) {
          const row = stmt.get()
          results.push({
            term: row[0] as string,
            paperCount: row[1] as number,
            trialCount: row[2] as number,
            searchTerms: parseJsonSafe(row[3] as string, []),
          })
        }
        stmt.free()
        return results
      } catch {
        return []
      }
    },
    [db],
  )

  const getPipelineRuns = useCallback((): PipelineRun[] => {
    if (!db) return []
    try {
      const rows = db.exec(
        "SELECT run_id, started_at, finished_at, status, error_message, phases_completed, papers_analyzed, trials_analyzed, forum_posts_analyzed, trigger, log FROM rs_pipeline_runs ORDER BY started_at DESC",
      )
      if (rows.length === 0) return []
      return rows[0].values.map((row) => ({
        runId: row[0] as string,
        startedAt: row[1] as string,
        finishedAt: row[2] as string | null,
        status: row[3] as "running" | "success" | "failure",
        errorMessage: row[4] as string | null,
        phasesCompleted: parseJsonSafe(row[5] as string, []),
        papersAnalyzed: (row[6] as number) ?? 0,
        trialsAnalyzed: (row[7] as number) ?? 0,
        forumPostsAnalyzed: (row[8] as number) ?? 0,
        trigger: (row[9] as string) ?? "",
        log: (row[10] as string) ?? "",
      }))
    } catch {
      return []
    }
  }, [db])

  const getAnalysisCoverage = useCallback((): AnalysisCoverage => {
    if (!db) return { totalPapers: 0, aiAnalyzed: 0, regexOnly: 0, errorCount: 0, totalTrials: 0, aiTrials: 0 }
    try {
      const paperRows = db.exec("SELECT COUNT(*) FROM pa_papers")
      const totalPapers = (paperRows[0]?.values[0]?.[0] as number) ?? 0

      const aiRows = db.exec("SELECT COUNT(*) FROM pa_analyses WHERE analysis_source = 'ai'")
      const aiAnalyzed = (aiRows[0]?.values[0]?.[0] as number) ?? 0

      const regexRows = db.exec("SELECT COUNT(*) FROM pa_analyses WHERE analysis_source = 'regex'")
      const regexOnly = (regexRows[0]?.values[0]?.[0] as number) ?? 0

      let errorCount = 0
      try {
        const errRows = db.exec("SELECT COUNT(*) FROM rs_analysis_errors")
        errorCount = (errRows[0]?.values[0]?.[0] as number) ?? 0
      } catch {
        // table may not exist
      }

      const trialRows = db.exec("SELECT COUNT(*) FROM tr_trials")
      const totalTrials = (trialRows[0]?.values[0]?.[0] as number) ?? 0

      let aiTrials = 0
      try {
        const aiTrialRows = db.exec("SELECT COUNT(*) FROM tr_analyses")
        aiTrials = (aiTrialRows[0]?.values[0]?.[0] as number) ?? 0
      } catch {
        // table may not exist
      }

      return { totalPapers, aiAnalyzed, regexOnly, errorCount, totalTrials, aiTrials }
    } catch {
      return { totalPapers: 0, aiAnalyzed: 0, regexOnly: 0, errorCount: 0, totalTrials: 0, aiTrials: 0 }
    }
  }, [db])

  const getAnalysisErrors = useCallback((): AnalysisError[] => {
    if (!db) return []
    try {
      const rows = db.exec(
        "SELECT id, error, timestamp, retry_count FROM rs_analysis_errors ORDER BY timestamp DESC",
      )
      if (rows.length === 0) return []
      return rows[0].values.map((row) => ({
        id: row[0] as string,
        error: row[1] as string,
        timestamp: row[2] as string,
        retryCount: (row[3] as number) ?? 0,
      }))
    } catch {
      return []
    }
  }, [db])

  const getDataFreshness = useCallback((): DataFreshness => {
    if (!db) return { newestPaperDate: null, newestTrialDate: null, lastRunAt: null }
    try {
      const paperRows = db.exec("SELECT MAX(pub_date) FROM pa_papers")
      const newestPaperDate = (paperRows[0]?.values[0]?.[0] as string | null) ?? null

      const trialRows = db.exec("SELECT MAX(start_date) FROM tr_trials")
      const newestTrialDate = (trialRows[0]?.values[0]?.[0] as string | null) ?? null

      let lastRunAt: string | null = null
      try {
        const runRows = db.exec("SELECT MAX(started_at) FROM rs_pipeline_runs")
        lastRunAt = (runRows[0]?.values[0]?.[0] as string | null) ?? null
      } catch {
        // table may not exist
      }

      return { newestPaperDate, newestTrialDate, lastRunAt }
    } catch {
      return { newestPaperDate: null, newestTrialDate: null, lastRunAt: null }
    }
  }, [db])

  const getResearchStats = useCallback((): Record<string, unknown> => {
    if (!db) return {}
    try {
      const rows = db.exec("SELECT key, value FROM rs_stats")
      if (rows.length === 0) return {}
      const obj: Record<string, unknown> = {}
      for (const row of rows[0].values) {
        obj[row[0] as string] = parseJsonSafe(row[1] as string, row[1])
      }
      return obj
    } catch {
      return {}
    }
  }, [db])

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
    getPaperAnalysis,
    getTrialAnalysis,
    getLinkedPapers,
    getLinkedTrials,
    getCategoryStats,
    getSubcategories,
    getResearchStats,
    getCommunityGroups,
    getPipelineRuns,
    getAnalysisCoverage,
    getAnalysisErrors,
    getDataFreshness,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <h2 className="text-lg font-semibold">Failed to load data</h2>
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Reload page
        </button>
      </div>
    )
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

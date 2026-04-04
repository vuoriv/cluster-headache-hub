import Database from "better-sqlite3"
import type { EnrichedTrial, EnrichedPaper } from "./types.js"

const SCHEMA = `
CREATE TABLE IF NOT EXISTS trials (
  nct_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  phase TEXT,
  study_type TEXT,
  sponsor TEXT,
  enrollment INTEGER,
  start_date TEXT,
  end_date TEXT,
  interventions TEXT,
  summary TEXT,
  conditions TEXT,
  category TEXT,
  relevance_score REAL,
  last_updated TEXT,
  raw_json TEXT
);

CREATE TABLE IF NOT EXISTS papers (
  pmid TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT,
  journal TEXT,
  pub_date TEXT,
  abstract TEXT,
  mesh_terms TEXT,
  category TEXT,
  relevance_score REAL,
  last_updated TEXT
);

CREATE TABLE IF NOT EXISTS pipeline_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_trials_category ON trials(category);
CREATE INDEX IF NOT EXISTS idx_trials_status ON trials(status);
CREATE INDEX IF NOT EXISTS idx_papers_category ON papers(category);
CREATE INDEX IF NOT EXISTS idx_papers_pub_date ON papers(pub_date);
`

export function buildDatabase(
  dbPath: string,
  trials: EnrichedTrial[],
  papers: EnrichedPaper[],
): void {
  console.log(`Building database at ${dbPath}...`)

  const db = new Database(dbPath)
  db.pragma("journal_mode = WAL")

  // Create schema
  db.exec(SCHEMA)

  // Clear existing data
  db.exec("DELETE FROM trials")
  db.exec("DELETE FROM papers")
  db.exec("DELETE FROM pipeline_meta")

  const now = new Date().toISOString()

  // Insert trials
  const insertTrial = db.prepare(`
    INSERT OR REPLACE INTO trials
    (nct_id, title, status, phase, study_type, sponsor, enrollment,
     start_date, end_date, interventions, summary, conditions,
     category, relevance_score, last_updated, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertTrials = db.transaction((trials: EnrichedTrial[]) => {
    for (const t of trials) {
      insertTrial.run(
        t.nctId,
        t.title,
        t.status,
        JSON.stringify(t.phase),
        t.studyType,
        t.sponsor,
        t.enrollment,
        t.startDate,
        t.endDate,
        JSON.stringify(t.interventions),
        t.summary,
        t.conditions.join(", "),
        t.category,
        t.relevanceScore,
        now,
        t.rawJson,
      )
    }
  })

  insertTrials(trials)
  console.log(`  Inserted ${trials.length} trials`)

  // Insert papers
  const insertPaper = db.prepare(`
    INSERT OR REPLACE INTO papers
    (pmid, title, authors, journal, pub_date, abstract, mesh_terms,
     category, relevance_score, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertPapers = db.transaction((papers: EnrichedPaper[]) => {
    for (const p of papers) {
      insertPaper.run(
        p.pmid,
        p.title,
        p.authors,
        p.journal,
        p.pubDate,
        p.abstract,
        JSON.stringify(p.meshTerms),
        p.category,
        p.relevanceScore,
        now,
      )
    }
  })

  insertPapers(papers)
  console.log(`  Inserted ${papers.length} papers`)

  // Write metadata
  const insertMeta = db.prepare(
    "INSERT OR REPLACE INTO pipeline_meta (key, value) VALUES (?, ?)",
  )
  insertMeta.run("last_run", now)
  insertMeta.run("trial_count", String(trials.length))
  insertMeta.run("paper_count", String(papers.length))

  // Category breakdown
  const trialCategories: Record<string, number> = {}
  for (const t of trials) {
    trialCategories[t.category] = (trialCategories[t.category] || 0) + 1
  }
  insertMeta.run("trial_categories", JSON.stringify(trialCategories))

  const paperCategories: Record<string, number> = {}
  for (const p of papers) {
    paperCategories[p.category] = (paperCategories[p.category] || 0) + 1
  }
  insertMeta.run("paper_categories", JSON.stringify(paperCategories))

  db.close()
  console.log("  Database built successfully")
}

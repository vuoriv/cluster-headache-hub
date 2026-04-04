import path from "path"
import { fileURLToPath } from "url"
import { fetchTrials } from "./fetch-trials.js"
import { fetchPapers } from "./fetch-papers.js"
import { enrichTrials, enrichPapers } from "./enrich.js"
import { buildDatabase } from "./build-db.js"
import { mergeDatabases } from "./merge-db.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, ".cache/research.db")

async function main() {
  console.log("=== Research Data Pipeline ===\n")
  const start = Date.now()

  // Fetch from APIs
  const rawTrials = await fetchTrials()
  const rawPapers = await fetchPapers()

  // Enrich with categories and relevance scores
  const trials = enrichTrials(rawTrials)
  const papers = enrichPapers(rawPapers)

  // Build SQLite database
  buildDatabase(DB_PATH, trials, papers)

  // Merge with analysis.db into single data.db
  mergeDatabases()

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n=== Pipeline complete in ${elapsed}s ===`)

  // Summary
  const activeTrials = trials.filter((t) =>
    ["RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING"].includes(t.status),
  )
  const psychedelicTrials = trials.filter((t) => t.category === "psychedelic")

  console.log(`\nSummary:`)
  console.log(`  Total trials: ${trials.length} (${activeTrials.length} active)`)
  console.log(`  Psychedelic trials: ${psychedelicTrials.length}`)
  console.log(`  Total papers: ${papers.length}`)
  console.log(`  Papers with abstracts: ${papers.filter((p) => p.abstract).length}`)
  console.log(`  Output: ${DB_PATH}`)
}

main().catch((err) => {
  console.error("Pipeline failed:", err)
  process.exit(1)
})

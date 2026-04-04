import Database from "better-sqlite3"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.resolve(__dirname, "../../public")

const CACHE = path.resolve(__dirname, ".cache")
const DATA_DIR = path.resolve(__dirname, "../../data")
const ANALYSIS_DB = path.join(DATA_DIR, "analysis.db")
const RESEARCH_DB = path.join(CACHE, "research.db")
const OUTPUT_DB = path.join(PUBLIC, "data.db")

export function mergeDatabases(): void {
  console.log("Merging databases into data.db...")

  // Start from research.db as base (it has the research tables)
  if (!fs.existsSync(RESEARCH_DB)) {
    throw new Error(`research.db not found at ${RESEARCH_DB} — run 'npm run pipeline' first`)
  }

  // Copy research.db to data.db
  fs.copyFileSync(RESEARCH_DB, OUTPUT_DB)
  const db = new Database(OUTPUT_DB)

  // Attach analysis.db and copy its tables
  if (fs.existsSync(ANALYSIS_DB)) {
    db.exec(`ATTACH DATABASE '${ANALYSIS_DB}' AS analysis`)

    // Get all tables from analysis.db
    const tables = db
      .prepare(
        "SELECT name, sql FROM analysis.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all() as { name: string; sql: string }[]

    for (const { name, sql } of tables) {
      // Skip if table already exists in research.db
      const exists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        )
        .get(name)

      if (exists) {
        console.log(`  Skipping ${name} (already exists in research.db)`)
        continue
      }

      // Create table and copy data
      db.exec(sql)
      db.exec(`INSERT INTO main.${name} SELECT * FROM analysis.${name}`)
      const count = (
        db.prepare(`SELECT COUNT(*) as c FROM ${name}`).get() as {
          c: number
        }
      ).c
      console.log(`  Copied ${name} (${count} rows)`)
    }

    db.exec("DETACH DATABASE analysis")
  } else {
    console.log("  Warning: analysis.db not found, skipping forum data")
  }

  db.close()

  // Log sizes
  const dataSize = (fs.statSync(OUTPUT_DB).size / 1024).toFixed(0)
  console.log(`  Output: data.db (${dataSize} KB)`)
  console.log("  Merge complete")
}

// Run standalone
if (process.argv[1] && process.argv[1].includes("merge-db")) {
  mergeDatabases()
}

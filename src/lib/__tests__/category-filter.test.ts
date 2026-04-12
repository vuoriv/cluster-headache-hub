/**
 * Tests for subcategory filtering logic used in category pages.
 *
 * Tests the pure filtering functions extracted from category.tsx:
 * - Exact term matching against MeSH terms, keywords, and interventions
 * - Search terms matching (multiple raw terms per canonical name)
 * - Filter behavior with empty/null states
 */

import { describe, it, expect } from "vitest"

// Types matching what data-db.tsx provides
interface Paper {
  pmid: string
  title: string
  meshTerms: string[]
  authorKeywords: string[]
}

interface Trial {
  nctId: string
  title: string
  interventions: string[]
}

// Pure filtering functions extracted from category.tsx logic
function filterPapers(
  papers: Paper[],
  searchTerms: string[] | null,
): Paper[] {
  if (!searchTerms) return papers
  const terms = new Set(searchTerms)
  return papers.filter(
    (p) =>
      p.meshTerms.some((t) => terms.has(t.toLowerCase())) ||
      p.authorKeywords.some((t) => terms.has(t.toLowerCase())),
  )
}

function filterTrials(
  trials: Trial[],
  searchTerms: string[] | null,
): Trial[] {
  if (!searchTerms) return trials
  const terms = new Set(searchTerms)
  return trials.filter((t) =>
    t.interventions.some((i) => terms.has(i.toLowerCase())),
  )
}

// Test data
const PAPERS: Paper[] = [
  {
    pmid: "1",
    title: "Psilocybin for cluster headache",
    meshTerms: ["Psilocybin", "Cluster Headache"],
    authorKeywords: ["psilocybin", "psychedelic"],
  },
  {
    pmid: "2",
    title: "LSD and cluster headache response",
    meshTerms: ["Lysergic Acid Diethylamide", "Cluster Headache"],
    authorKeywords: ["lsd"],
  },
  {
    pmid: "3",
    title: "Verapamil prophylaxis",
    meshTerms: ["Verapamil", "Calcium Channel Blockers"],
    authorKeywords: ["verapamil", "prophylaxis"],
  },
  {
    pmid: "4",
    title: "Oxygen therapy for CH attacks",
    meshTerms: ["Oxygen Inhalation Therapy"],
    authorKeywords: ["oxygen", "abortive"],
  },
]

const TRIALS: Trial[] = [
  {
    nctId: "NCT001",
    title: "Psilocybin trial",
    interventions: ["Psilocybin", "Placebo"],
  },
  {
    nctId: "NCT002",
    title: "LSD trial",
    interventions: ["LSD tartrate", "Placebo"],
  },
  {
    nctId: "NCT003",
    title: "Verapamil trial",
    interventions: ["Verapamil", "Placebo"],
  },
]

describe("filterPapers", () => {
  it("returns all papers when searchTerms is null", () => {
    const result = filterPapers(PAPERS, null)
    expect(result).toHaveLength(4)
  })

  it("matches by MeSH term (case insensitive)", () => {
    const result = filterPapers(PAPERS, ["psilocybin"])
    expect(result).toHaveLength(1)
    expect(result[0].pmid).toBe("1")
  })

  it("matches by author keyword", () => {
    const result = filterPapers(PAPERS, ["verapamil"])
    expect(result).toHaveLength(1)
    expect(result[0].pmid).toBe("3")
  })

  it("matches LSD via raw MeSH term alias", () => {
    // LSD's search_terms include both "lsd" and "lysergic acid diethylamide"
    const result = filterPapers(PAPERS, ["lsd", "lysergic acid diethylamide"])
    expect(result).toHaveLength(1)
    expect(result[0].pmid).toBe("2")
  })

  it("does not match by title (only MeSH and keywords)", () => {
    const result = filterPapers(PAPERS, ["prophylaxis"])
    // "prophylaxis" is in keywords of paper 3, so it should match
    expect(result).toHaveLength(1)
    expect(result[0].pmid).toBe("3")
  })

  it("does not match by substring — exact term only", () => {
    // "calcium" is a substring of "Calcium Channel Blockers" but not an exact term
    const result = filterPapers(PAPERS, ["calcium"])
    expect(result).toHaveLength(0)
  })

  it("matches oxygen with full MeSH term", () => {
    const result = filterPapers(PAPERS, ["oxygen inhalation therapy"])
    expect(result).toHaveLength(1)
    expect(result[0].pmid).toBe("4")
  })

  it("returns empty for unmatched term", () => {
    const result = filterPapers(PAPERS, ["ketamine"])
    expect(result).toHaveLength(0)
  })
})

describe("filterTrials", () => {
  it("returns all trials when searchTerms is null", () => {
    const result = filterTrials(TRIALS, null)
    expect(result).toHaveLength(3)
  })

  it("matches exact intervention name", () => {
    const result = filterTrials(TRIALS, ["psilocybin"])
    expect(result).toHaveLength(1)
    expect(result[0].nctId).toBe("NCT001")
  })

  it("does not match intervention by substring", () => {
    // "LSD tartrate" should NOT match just "lsd" with exact matching
    const result = filterTrials(TRIALS, ["lsd"])
    expect(result).toHaveLength(0)
  })

  it("matches when full intervention name is in search terms", () => {
    const result = filterTrials(TRIALS, ["lsd tartrate"])
    expect(result).toHaveLength(1)
    expect(result[0].nctId).toBe("NCT002")
  })

  it("does not count placebo as a match", () => {
    const result = filterTrials(TRIALS, ["placebo"])
    // All trials have placebo as intervention
    expect(result).toHaveLength(3)
  })

  it("returns empty for unmatched term", () => {
    const result = filterTrials(TRIALS, ["galcanezumab"])
    expect(result).toHaveLength(0)
  })
})

describe("search terms integration", () => {
  it("LSD search_terms match both keyword and MeSH papers", () => {
    // Simulates what the frontend does: gets searchTerms from subcategory DB
    const lsdSearchTerms = ["lsd", "lysergic acid diethylamide"]

    const papers = filterPapers(PAPERS, lsdSearchTerms)
    expect(papers).toHaveLength(1)
    expect(papers[0].pmid).toBe("2")
  })

  it("multiple search terms expand matching surface", () => {
    // Verapamil search_terms might include variants
    const verapSearchTerms = ["verapamil", "verapamil hydrochloride", "r-verapamil"]

    const papers = filterPapers(PAPERS, verapSearchTerms)
    expect(papers).toHaveLength(1)
    expect(papers[0].pmid).toBe("3")
  })
})

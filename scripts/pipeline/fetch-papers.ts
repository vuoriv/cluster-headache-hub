import type { RawPaper } from "./types.js"

const ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
const EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
const ESUMMARY = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"

const BATCH_SIZE = 100
const BATCH_DELAY = 400 // ms between batches to respect rate limits

export async function fetchPapers(): Promise<RawPaper[]> {
  console.log("Fetching papers from PubMed...")

  // Step 1: Search for all cluster headache PMIDs
  const searchParams = new URLSearchParams({
    db: "pubmed",
    term: "cluster headache[Title/Abstract]",
    retmax: "10000",
    retmode: "json",
    sort: "date",
  })

  const searchRes = await fetch(`${ESEARCH}?${searchParams}`)
  if (!searchRes.ok) throw new Error(`PubMed search HTTP ${searchRes.status}`)
  const searchData = await searchRes.json()
  const pmids: string[] = searchData.esearchresult?.idlist || []

  console.log(`  Found ${pmids.length} PMIDs`)
  if (!pmids.length) return []

  // Step 2: Fetch summaries in batches
  const papers: RawPaper[] = []
  const totalBatches = Math.ceil(pmids.length / BATCH_SIZE)

  for (let i = 0; i < pmids.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const batch = pmids.slice(i, i + BATCH_SIZE)

    console.log(`  Fetching summaries batch ${batchNum}/${totalBatches}...`)

    const sumParams = new URLSearchParams({
      db: "pubmed",
      id: batch.join(","),
      retmode: "json",
    })

    const sumRes = await fetch(`${ESUMMARY}?${sumParams}`)
    if (!sumRes.ok) {
      console.warn(`  Warning: batch ${batchNum} failed (HTTP ${sumRes.status}), skipping`)
      continue
    }

    const sumData = await sumRes.json()
    const result = sumData.result || {}

    for (const pmid of result.uids || []) {
      const r = result[pmid]
      if (!r) continue

      const authors = (r.authors || [])
        .slice(0, 3)
        .map((a: { name: string }) => a.name)
        .join(", ")
      const authorStr =
        (r.authors || []).length > 3 ? `${authors} et al.` : authors

      papers.push({
        pmid,
        title: r.title || "",
        authors: authorStr,
        journal: r.fulljournalname || r.source || "",
        pubDate: r.pubdate || "",
        abstract: "", // Will be fetched separately for top papers
        meshTerms: [],
      })
    }

    if (i + BATCH_SIZE < pmids.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY))
    }
  }

  // Step 3: Fetch abstracts for papers (in batches via efetch XML)
  console.log("  Fetching abstracts...")
  const abstractBatchSize = 50
  const abstractBatches = Math.ceil(papers.length / abstractBatchSize)

  for (let i = 0; i < papers.length; i += abstractBatchSize) {
    const batchNum = Math.floor(i / abstractBatchSize) + 1
    const batch = papers.slice(i, i + abstractBatchSize)
    const ids = batch.map((p) => p.pmid).join(",")

    if (batchNum % 10 === 0 || batchNum === 1) {
      console.log(`  Abstracts batch ${batchNum}/${abstractBatches}...`)
    }

    try {
      const fetchParams = new URLSearchParams({
        db: "pubmed",
        id: ids,
        rettype: "abstract",
        retmode: "xml",
      })

      const res = await fetch(`${EFETCH}?${fetchParams}`)
      if (!res.ok) continue

      const xml = await res.text()
      // Parse abstracts from XML
      const abstractMap = parseAbstracts(xml)

      for (const paper of batch) {
        if (abstractMap[paper.pmid]) {
          paper.abstract = abstractMap[paper.pmid]
        }
      }

      // Parse MeSH terms
      const meshMap = parseMeshTerms(xml)
      for (const paper of batch) {
        if (meshMap[paper.pmid]) {
          paper.meshTerms = meshMap[paper.pmid]
        }
      }
    } catch {
      // Continue without abstracts for this batch
    }

    if (i + abstractBatchSize < papers.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY))
    }
  }

  const withAbstracts = papers.filter((p) => p.abstract).length
  console.log(`  Fetched ${papers.length} papers (${withAbstracts} with abstracts)`)
  return papers
}

function parseAbstracts(xml: string): Record<string, string> {
  const result: Record<string, string> = {}

  // Split by PubmedArticle
  const articles = xml.split("<PubmedArticle>").slice(1)
  for (const article of articles) {
    const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/)
    if (!pmidMatch) continue
    const pmid = pmidMatch[1]

    const abstractMatch = article.match(
      /<Abstract>([\s\S]*?)<\/Abstract>/,
    )
    if (!abstractMatch) continue

    // Extract text from AbstractText elements
    const textParts = abstractMatch[1].match(
      /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g,
    )
    if (!textParts) continue

    const text = textParts
      .map((part) => {
        const labelMatch = part.match(/Label="([^"]*)"/)
        const content = part
          .replace(/<[^>]+>/g, "")
          .trim()
        return labelMatch ? `${labelMatch[1]}: ${content}` : content
      })
      .join(" ")

    result[pmid] = text
  }

  return result
}

function parseMeshTerms(xml: string): Record<string, string[]> {
  const result: Record<string, string[]> = {}

  const articles = xml.split("<PubmedArticle>").slice(1)
  for (const article of articles) {
    const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/)
    if (!pmidMatch) continue
    const pmid = pmidMatch[1]

    const meshSection = article.match(
      /<MeshHeadingList>([\s\S]*?)<\/MeshHeadingList>/,
    )
    if (!meshSection) continue

    const descriptors = meshSection[1].match(
      /<DescriptorName[^>]*>([\s\S]*?)<\/DescriptorName>/g,
    )
    if (!descriptors) continue

    result[pmid] = descriptors.map((d) =>
      d.replace(/<[^>]+>/g, "").trim(),
    )
  }

  return result
}

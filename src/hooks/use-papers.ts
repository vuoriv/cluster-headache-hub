import { useState, useEffect } from "react"
import type { Paper } from "@/lib/types"

interface PapersState {
  papers: Paper[]
  totalCount: number
  loading: boolean
  error: string | null
  progress: string
}

export function usePapers(): PapersState {
  const [state, setState] = useState<PapersState>({
    papers: [],
    totalCount: 0,
    loading: true,
    error: null,
    progress: "",
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const searchUrl =
          "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=cluster+headache%5BTitle%2FAbstract%5D&retmax=500&retmode=json&sort=date"
        const searchRes = await fetch(searchUrl)
        if (!searchRes.ok) throw new Error("PubMed search HTTP " + searchRes.status)
        const searchData = await searchRes.json()
        const pmids: string[] = searchData.esearchresult.idlist || []
        const total = parseInt(searchData.esearchresult.count) || 0

        if (!pmids.length) throw new Error("No papers returned")

        const batchSize = 100
        const totalBatches = Math.ceil(pmids.length / batchSize)
        const papers: Paper[] = []

        for (let i = 0; i < pmids.length; i += batchSize) {
          const batchNum = Math.floor(i / batchSize) + 1
          if (!cancelled) setState((prev) => ({ ...prev, progress: `Loading batch ${batchNum}/${totalBatches}…` }))

          const batch = pmids.slice(i, i + batchSize).join(",")
          const sumUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${batch}&retmode=json`
          const sumRes = await fetch(sumUrl)
          if (!sumRes.ok) continue
          const sumData = await sumRes.json()
          const result = sumData.result || {}

          for (const pmid of result.uids || []) {
            const r = result[pmid]
            if (!r) continue
            papers.push({
              pmid,
              title: r.title || "",
              authors:
                (r.authors || [])
                  .slice(0, 3)
                  .map((a: { name: string }) => a.name)
                  .join(", ") + ((r.authors || []).length > 3 ? " et al." : ""),
              journal: r.fulljournalname || r.source || "",
              pubdate: r.pubdate || "",
              epubdate: r.epubdate || "",
            })
          }

          if (i + batchSize < pmids.length) {
            await new Promise((r) => setTimeout(r, 350))
          }
        }

        if (!cancelled) setState({ papers, totalCount: total, loading: false, error: null, progress: "" })
      } catch (e) {
        if (!cancelled) setState((prev) => ({ ...prev, loading: false, error: (e as Error).message }))
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return state
}

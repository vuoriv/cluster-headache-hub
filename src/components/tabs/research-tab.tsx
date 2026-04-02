import { useState, useMemo, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import type { Paper } from "@/lib/types"

interface ResearchTabProps {
  papers: Paper[]
  totalCount: number
  loading: boolean
  error: string | null
  progress: string
}

export function ResearchTab({ papers, totalCount, loading, error, progress }: ResearchTabProps) {
  const [search, setSearch] = useState("")
  const [yearFilter, setYearFilter] = useState("all")
  const [perPage, setPerPage] = useState(25)
  const [page, setPage] = useState(1)

  const years = useMemo(() => {
    const ys = [...new Set(papers.map((p) => p.pubdate.slice(0, 4)).filter((y) => /^\d{4}$/.test(y)))]
    return ys.sort().reverse()
  }, [papers])

  useEffect(() => {
    setPage(1)
  }, [papers, search, yearFilter])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return papers.filter((p) => {
      const text = `${p.title} ${p.authors} ${p.journal}`.toLowerCase()
      if (q && !text.includes(q)) return false
      if (yearFilter !== "all" && !p.pubdate.startsWith(yearFilter)) return false
      return true
    })
  }, [papers, search, yearFilter])

  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <Skeleton className="h-8 w-48" />
        <p className="text-sm text-muted-foreground">{progress || "Loading from PubMed…"}</p>
        <div className="flex flex-col gap-3 w-full max-w-2xl">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (error && papers.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Could not load papers from PubMed: {error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold">Latest Research Papers</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Recent cluster headache publications, fetched live from PubMed ({totalCount.toLocaleString()}+ total, sorted by date)
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by title, journal, authors…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1"
        />
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All Years</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1) }}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="25">25 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length.toLocaleString()} paper{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {paginated.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">No papers match your search.</p>
        ) : (
          paginated.map((p) => {
            const year = p.pubdate.slice(0, 4)
            const yearVariant = year >= "2025" ? "success" : year >= "2024" ? "info" : "secondary"
            return (
            <Card key={p.pmid} className="transition-all hover:shadow-md hover:border-ring">
              <CardContent className="flex gap-4 py-3.5">
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <Badge variant={yearVariant as "success" | "info" | "secondary"} className="text-[0.65rem] tabular-nums">{year}</Badge>
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[0.6rem] text-muted-foreground/50 hover:text-primary"
                    title={`PubMed ID: ${p.pmid}`}
                  >
                    {p.pmid}
                  </a>
                </div>
                <div className="min-w-0 flex-1">
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold leading-snug text-foreground hover:text-primary"
                  >
                    {p.title}
                  </a>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{p.authors}</span>
                    {p.journal && <Badge variant="outline" className="text-[0.6rem] font-normal">{p.journal}</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>
            )
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Prev
          </Button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let p: number
            if (totalPages <= 7) {
              p = i + 1
            } else if (page <= 4) {
              p = i + 1
            } else if (page >= totalPages - 3) {
              p = totalPages - 6 + i
            } else {
              p = page - 3 + i
            }
            return (
              <Button key={p} variant={p === page ? "default" : "outline"} size="sm" onClick={() => setPage(p)}>
                {p}
              </Button>
            )
          })}
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next →
          </Button>
        </div>
      )}
    </div>
  )
}

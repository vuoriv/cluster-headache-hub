import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Search, BookOpen, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useDataDb, type ResearchPaper } from "@/lib/data-db"
import { CATEGORY_CONFIG } from "@/lib/research-categories"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 25

export function ResearchSearchPage() {
  const { t } = useTranslation()
  const { loading, error, searchPapers, getCategories, getMeta } = useDataDb()
  const stats = useMemo(() => (loading ? null : getMeta()), [loading, getMeta])

  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [yearFrom, setYearFrom] = useState<string>("")
  const [yearTo, setYearTo] = useState<string>("")
  const [page, setPage] = useState(0)
  const [expandedPmid, setExpandedPmid] = useState<string | null>(null)

  const categories = useMemo(() => getCategories(), [getCategories])

  const papers = useMemo(() => {
    if (loading) return []
    return searchPapers({
      query: query || undefined,
      category: category === "all" ? undefined : category,
      yearFrom: yearFrom ? parseInt(yearFrom) : undefined,
      yearTo: yearTo ? parseInt(yearTo) : undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
  }, [loading, searchPapers, query, category, yearFrom, yearTo, page])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") setPage(0)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <BookOpen className="size-12 text-muted-foreground/30" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold">{t("research.title", "Latest Research Papers")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {stats?.paperCount?.toLocaleString() ?? "—"}+ cluster headache papers from{" "}
          <a href="https://pubmed.ncbi.nlm.nih.gov" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground/70 hover:underline">PubMed</a>
          , categorized and scored for relevance
        </p>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title, abstract, or researcher name..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0) }}
            onKeyDown={handleKeyDown}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="From"
            value={yearFrom}
            onChange={(e) => { setYearFrom(e.target.value); setPage(0) }}
            className="h-9 w-[80px] text-xs"
            min="1950"
            max="2030"
          />
          <span className="flex items-center text-xs text-muted-foreground">–</span>
          <Input
            type="number"
            placeholder="To"
            value={yearTo}
            onChange={(e) => { setYearTo(e.target.value); setPage(0) }}
            className="h-9 w-[80px] text-xs"
            min="1950"
            max="2030"
          />
        </div>
      </div>

      {/* Category label filters */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => { setCategory("all"); setPage(0) }}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            category === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          All
        </button>
        {categories.map((cat) => {
          const cfg = CATEGORY_CONFIG[cat]
          if (!cfg) return null
          const active = category === cat
          return (
            <button
              key={cat}
              onClick={() => { setCategory(active ? "all" : cat); setPage(0) }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {cfg.label}
            </button>
          )
        })}
      </div>

      {/* Results hint */}
      {!loading && !query && category === "all" && !yearFrom && !yearTo && papers.length > 0 && (
        <p className="text-xs font-medium text-muted-foreground">
          Showing highest-relevance papers. Use search and filters to narrow results.
        </p>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {papers.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <BookOpen className="size-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  No papers found matching your search
                </p>
              </div>
            ) : (
              papers.map((paper) => (
                <PaperCard
                  key={paper.pmid}
                  paper={paper}
                  expanded={expandedPmid === paper.pmid}
                  onToggle={() =>
                    setExpandedPmid(expandedPmid === paper.pmid ? null : paper.pmid)
                  }
                  onAuthorClick={(author) => { setQuery(author); setPage(0) }}
                />
              ))
            )}
          </div>

          {papers.length > 0 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page + 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={papers.length < PAGE_SIZE}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PaperCard({
  paper,
  expanded,
  onToggle,
  onAuthorClick,
}: {
  paper: ResearchPaper
  expanded: boolean
  onToggle: () => void
  onAuthorClick: (author: string) => void
}) {
  const catConfig = CATEGORY_CONFIG[paper.category]
  const year = paper.pubDate?.slice(0, 4) || ""

  // Extract first author surname for clickable filter
  const firstAuthor = paper.authors?.split(",")[0]?.trim()

  return (
    <Card className="transition-all hover:shadow-sm">
      <CardHeader className="cursor-pointer pb-2" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold leading-snug">{paper.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {firstAuthor && (
                <button
                  className="font-medium text-foreground/70 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAuthorClick(firstAuthor)
                  }}
                >
                  {firstAuthor}
                </button>
              )}
              {paper.authors?.includes(",") && (
                <span>, {paper.authors.split(",").slice(1).join(",")}</span>
              )}
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {catConfig && (
            <Badge variant={catConfig.variant} className="text-[0.65rem]">
              {catConfig.label}
            </Badge>
          )}
          {year && (
            <Badge variant="outline" className="text-[0.65rem]">
              {year}
            </Badge>
          )}
          <span className="text-[0.65rem] text-muted-foreground">
            {paper.journal}
          </span>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {paper.abstract ? (
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              {paper.abstract}
            </p>
          ) : (
            <p className="mb-3 text-xs italic text-muted-foreground/60">
              No abstract available
            </p>
          )}

          {paper.meshTerms.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {paper.meshTerms.slice(0, 8).map((term) => (
                <Badge key={term} variant="secondary" className="text-[0.6rem]">
                  {term}
                </Badge>
              ))}
            </div>
          )}

          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View on PubMed <ExternalLink className="size-3" />
          </a>
        </CardContent>
      )}
    </Card>
  )
}

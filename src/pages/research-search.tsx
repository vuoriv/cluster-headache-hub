import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { Link } from "react-router-dom"
import { Search, BookOpen, ArrowLeft } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PaperCard } from "@/components/paper-card"
import { useDataDb } from "@/lib/data-db"
import { CATEGORY_CONFIG } from "@/lib/research-categories"
import { cn } from "@/lib/utils"

const BATCH_SIZE = 30

export function ResearchSearchPage() {
  const { loading, error, searchPapers, getCategories, getMeta, getTopAuthors } = useDataDb()
  const stats = useMemo(() => (loading ? null : getMeta()), [loading, getMeta])
  const topAuthors = useMemo(() => (loading ? [] : getTopAuthors(150)), [loading, getTopAuthors])

  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [author, setAuthor] = useState<string>("all")
  const [yearFrom, setYearFrom] = useState<string>("")
  const [yearTo, setYearTo] = useState<string>("")
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const [expandedPmid, setExpandedPmid] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const categories = useMemo(() => getCategories(), [getCategories])

  // Fetch a larger batch for infinite scroll
  const allResults = useMemo(() => {
    if (loading) return []
    const authorQuery = author !== "all" ? author : undefined
    const searchQuery = query || authorQuery || undefined
    return searchPapers({
      query: searchQuery,
      category: category === "all" ? undefined : category,
      yearFrom: yearFrom ? parseInt(yearFrom) : undefined,
      yearTo: yearTo ? parseInt(yearTo) : undefined,
      limit: 500,
      offset: 0,
    })
  }, [loading, searchPapers, query, category, author, yearFrom, yearTo])

  const papers = useMemo(
    () => allResults.slice(0, visibleCount),
    [allResults, visibleCount],
  )
  const hasMore = visibleCount < allResults.length

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE)
  }, [query, category, author, yearFrom, yearTo])

  // Infinite scroll via IntersectionObserver
  const loadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount((prev) => prev + BATCH_SIZE)
    }
  }, [hasMore])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: "200px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

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
      <Link to="/research" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to Research
      </Link>

      <div>
        <h2 className="text-2xl font-bold">All Papers</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {stats?.paperCount?.toLocaleString() ?? "—"}+ cluster headache papers from PubMed
        </p>
      </div>

      {/* Search + Author + Year */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title, abstract, or author..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={author} onValueChange={setAuthor}>
          <SelectTrigger className="h-9 w-full text-xs sm:w-[200px]">
            <SelectValue placeholder="Researcher" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="all">All researchers</SelectItem>
            {topAuthors.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="From"
            value={yearFrom}
            onChange={(e) => setYearFrom(e.target.value)}
            className="h-9 w-[80px] text-xs"
            min="1950"
            max="2030"
          />
          <span className="flex items-center text-xs text-muted-foreground">–</span>
          <Input
            type="number"
            placeholder="To"
            value={yearTo}
            onChange={(e) => setYearTo(e.target.value)}
            className="h-9 w-[80px] text-xs"
            min="1950"
            max="2030"
          />
        </div>
      </div>

      {/* Category label filters */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setCategory("all")}
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
              onClick={() => setCategory(active ? "all" : cat)}
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

      {/* Result count */}
      <p className="text-xs text-muted-foreground">
        {allResults.length === 500
          ? "Showing top 500 results"
          : `${allResults.length} papers found`}
        {query || category !== "all" || author !== "all" || yearFrom || yearTo
          ? " matching your filters"
          : " — highest relevance first"}
      </p>

      {/* Results */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : papers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <BookOpen className="size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No papers found matching your search
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {papers.map((paper) => (
              <PaperCard
                key={paper.pmid}
                paper={paper}
                showCategory
                expanded={expandedPmid === paper.pmid}
                onToggle={() =>
                  setExpandedPmid(expandedPmid === paper.pmid ? null : paper.pmid)
                }
                onAuthorClick={(a) => setAuthor(a)}
              />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="flex justify-center py-4">
            {hasMore && (
              <p className="text-xs text-muted-foreground">Loading more...</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

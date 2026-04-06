import { useState, useMemo } from "react"
import { Link } from "react-router-dom"
import {
  FlaskConical,
  Search,
  ExternalLink,
  ArrowLeft,
  Lightbulb,
  Users,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useDataDb, type ResearchTrial } from "@/lib/data-db"
import { CATEGORY_CONFIG, STATUS_CONFIG, phaseLabel } from "@/lib/research-categories"
import { cn } from "@/lib/utils"

export function ActiveTrialsPage() {
  const { loading, error, searchTrials } = useDataDb()

  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [expandedNct, setExpandedNct] = useState<string | null>(null)

  const allTrials = useMemo(() => {
    if (loading) return []
    // Get all trials, not just active
    return searchTrials({})
  }, [loading, searchTrials])

  // Get categories that actually exist in active trials
  const activeCategories = useMemo(() => {
    const cats = new Set(allTrials.map((t) => t.category))
    return Object.keys(CATEGORY_CONFIG).filter((k) => cats.has(k))
  }, [allTrials])

  const trials = useMemo(() => {
    if (loading) return []
    if (!query && statusFilter === "all" && categoryFilter === "all") {
      return allTrials
    }
    return searchTrials({
      query: query || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      category: categoryFilter === "all" ? undefined : categoryFilter,
    })
  }, [loading, allTrials, searchTrials, query, statusFilter, categoryFilter])

  const stats = useMemo(() => {
    if (loading) return null
    const active = allTrials.filter((t) => ["RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING"].includes(t.status))
    return {
      total: allTrials.length,
      active: active.length,
      completed: allTrials.filter((t) => t.status === "COMPLETED").length,
      recruiting: allTrials.filter((t) => t.status === "RECRUITING").length,
    }
  }, [loading, allTrials])

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <FlaskConical className="size-12 text-muted-foreground/30" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/research" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to Research
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Clinical Trials</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All 106 cluster headache trials from{" "}
            <a href="https://clinicaltrials.gov" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground/70 hover:underline">ClinicalTrials.gov</a>
            {" "}— with deep analysis of what was tested and what happened
          </p>
        </div>
        {stats && (
          <div className="flex gap-3">
            <StatBadge value={stats.total} label="Total" />
            <StatBadge value={stats.active} label="Active" />
            <StatBadge value={stats.completed} label="Completed" />
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative sm:max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by title, intervention, or sponsor..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status label filters */}
      <div className="flex flex-wrap gap-1.5">
        <span className="mr-1 flex items-center text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Status</span>
        {(["all", "RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING", "COMPLETED", "TERMINATED"] as const).map((status) => {
          const active = statusFilter === status
          const label = status === "all" ? "All" : STATUS_CONFIG[status]?.label ?? status
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(active && status !== "all" ? "all" : status)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Category label filters */}
      <div className="flex flex-wrap gap-1.5">
        <span className="mr-1 flex items-center text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Type</span>
        <button
          onClick={() => setCategoryFilter("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            categoryFilter === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          All
        </button>
        {activeCategories.map((cat) => {
          const cfg = CATEGORY_CONFIG[cat]
          if (!cfg) return null
          const active = categoryFilter === cat
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(active ? "all" : cat)}
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

      {/* Trial Cards */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : trials.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <FlaskConical className="size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No trials found matching your filters
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {trials.map((trial) => (
            <TrialCard
              key={trial.nctId}
              trial={trial}
              expanded={expandedNct === trial.nctId}
              onToggle={() =>
                setExpandedNct(expandedNct === trial.nctId ? null : trial.nctId)
              }
              onSponsorClick={(sponsor) => setQuery(sponsor)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StatBadge({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-md bg-muted/60 px-3 py-1.5">
      <span className="text-lg font-bold tabular-nums">{value}</span>
      <span className="text-[0.6rem] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

function TrialCard({
  trial,
  expanded,
  onToggle,
  onSponsorClick,
}: {
  trial: ResearchTrial
  expanded: boolean
  onToggle: () => void
  onSponsorClick: (sponsor: string) => void
}) {
  const catConfig = CATEGORY_CONFIG[trial.category]
  const statConfig = STATUS_CONFIG[trial.status]

  return (
    <Card className="transition-all hover:shadow-sm">
      <CardHeader className="cursor-pointer pb-2" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold leading-snug">{trial.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              <button
                className="font-medium text-foreground/70 hover:underline"
                onClick={(e) => {
                  e.stopPropagation()
                  onSponsorClick(trial.sponsor)
                }}
              >
                {trial.sponsor}
              </button>
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {statConfig && (
            <Badge variant={statConfig.variant} className="text-[0.65rem]">
              {statConfig.label}
            </Badge>
          )}
          {catConfig && (
            <Badge variant={catConfig.variant} className="text-[0.65rem]">
              {catConfig.label}
            </Badge>
          )}
          <Badge variant="outline" className="text-[0.65rem]">
            {phaseLabel(trial.phase)}
          </Badge>
          {trial.enrollment && (
            <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
              <Users className="size-3" />
              {trial.enrollment}
            </span>
          )}
          {trial.startDate && (
            <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
              <Calendar className="size-3" />
              {trial.startDate}
            </span>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <TrialAnalysis nctId={trial.nctId} />

          {trial.summary && (
            <details className="mb-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                Full study description
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {trial.summary}
              </p>
            </details>
          )}

          <div className="mb-3 grid gap-2 text-xs sm:grid-cols-2">
            {trial.interventions.length > 0 && (
              <div>
                <span className="font-medium">Interventions: </span>
                <span className="text-muted-foreground">
                  {trial.interventions.join(", ")}
                </span>
              </div>
            )}
            {trial.conditions && (
              <div>
                <span className="font-medium">Conditions: </span>
                <span className="text-muted-foreground">{trial.conditions}</span>
              </div>
            )}
            <div>
              <span className="font-medium">Type: </span>
              <span className="text-muted-foreground">{trial.studyType}</span>
            </div>
            {trial.endDate && (
              <div>
                <span className="font-medium">Est. completion: </span>
                <span className="text-muted-foreground">{trial.endDate}</span>
              </div>
            )}
          </div>

          <a
            href={`https://clinicaltrials.gov/study/${trial.nctId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View on ClinicalTrials.gov <ExternalLink className="size-3" />
          </a>
        </CardContent>
      )}
    </Card>
  )
}

const VERDICT_BADGES: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "info" | "secondary" | "outline" }> = {
  success: { label: "Succeeded", variant: "success" },
  failure: { label: "Failed", variant: "destructive" },
  mixed: { label: "Mixed Results", variant: "warning" },
  ongoing: { label: "Ongoing", variant: "info" },
  terminated: { label: "Terminated", variant: "secondary" },
  unknown: { label: "No Results Posted", variant: "outline" },
}

function TrialAnalysis({ nctId }: { nctId: string }) {
  const { getTrialAnalysis } = useDataDb()
  const analysis = getTrialAnalysis(nctId)
  if (!analysis) return null

  const badge = VERDICT_BADGES[analysis.verdict]

  return (
    <div className="mb-4 rounded-lg border bg-muted/30 p-3">
      <div className="mb-2 flex items-start gap-2">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold">Analysis</span>
            {badge && <Badge variant={badge.variant} className="text-[0.6rem]">{badge.label}</Badge>}
            {analysis.doseTested && (
              <Badge variant="outline" className="text-[0.6rem]">{analysis.doseTested}</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 pl-5.5">
        <p className="text-xs leading-relaxed">
          <span className="font-medium">What was tested: </span>
          <span className="text-muted-foreground">{analysis.whatTested}</span>
        </p>
        {analysis.keyResult && (
          <p className="text-xs leading-relaxed">
            <span className="font-medium">Result: </span>
            <span className="text-muted-foreground">{analysis.keyResult}</span>
          </p>
        )}
        <p className="text-xs leading-relaxed">
          <span className="font-medium">For patients: </span>
          <span className="text-muted-foreground">{analysis.patientRelevance}</span>
        </p>
      </div>
    </div>
  )
}

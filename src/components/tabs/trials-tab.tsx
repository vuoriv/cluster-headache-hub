import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ChevronDown, ChevronRight, ExternalLink, Users, Calendar, FlaskConical } from "lucide-react"
import type { Trial } from "@/lib/types"
import { categoryForTrial, statusLabel, phaseLabel, CATEGORY_VARIANTS, CATEGORY_LABELS } from "@/lib/types"

interface TrialsTabProps {
  trials: Trial[]
  loading: boolean
  error: string | null
  isFallback: boolean
}

const STATUS_BADGE_VARIANTS: Record<string, "success" | "warning" | "info" | "secondary"> = {
  RECRUITING: "success",
  NOT_YET_RECRUITING: "warning",
  ACTIVE_NOT_RECRUITING: "info",
}

function TrialCard({ trial, expanded, onToggle }: { trial: Trial; expanded: boolean; onToggle: () => void }) {
  const cat = categoryForTrial(trial)
  const pl = phaseLabel(trial.phase)

  return (
    <Card className="group transition-all hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={CATEGORY_VARIANTS[cat]} className="text-[0.68rem]">
              {CATEGORY_LABELS[cat]}
            </Badge>
            <Badge variant={STATUS_BADGE_VARIANTS[trial.status] || "secondary"}>
              {statusLabel(trial.status)}
            </Badge>
            {pl !== "—" && (
              <Badge variant="outline" className="text-[0.68rem]">{pl}</Badge>
            )}
          </div>
          <a
            href={`https://clinicaltrials.gov/study/${trial.nct}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-mono text-muted-foreground transition-colors hover:text-primary"
          >
            {trial.nct}
            <ExternalLink className="size-3" />
          </a>
        </div>
        <CardTitle className="text-sm leading-snug">
          {trial.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FlaskConical className="size-3" />
            {trial.sponsor}
          </span>
          {trial.enrollment !== "—" && (
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              {String(trial.enrollment)} enrolled
            </span>
          )}
          {trial.end && (
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              Est. end: {trial.end}
            </span>
          )}
        </div>

        {trial.interventions && (
          <p className="mt-2 text-xs text-muted-foreground">
            <strong className="text-foreground/70">Interventions:</strong> {trial.interventions}
          </p>
        )}

        {trial.summary && trial.summary.length > 20 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-auto px-0 py-0.5 text-xs"
              onClick={onToggle}
            >
              {expanded ? <ChevronDown className="mr-1" /> : <ChevronRight className="mr-1" />}
              {expanded ? "Hide details" : "Show details"}
            </Button>
            {expanded && (
              <>
                <Separator className="my-2" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {trial.summary}
                </p>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function TrialsTab({ trials, loading, error, isFallback }: TrialsTabProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [phaseFilter, setPhaseFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [expandedNct, setExpandedNct] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return trials.filter((t) => {
      const text = `${t.nct} ${t.title} ${t.sponsor} ${t.interventions} ${t.conditions}`.toLowerCase()
      if (q && !text.includes(q)) return false
      if (statusFilter !== "all" && t.status !== statusFilter) return false
      if (phaseFilter !== "all" && !t.phase.includes(phaseFilter)) return false
      if (typeFilter !== "all" && t.type !== typeFilter) return false
      return true
    })
  }, [trials, search, statusFilter, phaseFilter, typeFilter])

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold">Active Clinical Trials</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All cluster headache trials currently recruiting, active, or starting soon — fetched live from ClinicalTrials.gov
        </p>
      </div>

      {isFallback && error && (
        <Alert variant="warning">
          <AlertDescription>
            Showing cached data — live fetch failed ({error}). Refresh to retry.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search trials…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[180px] flex-1"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="RECRUITING">Recruiting</SelectItem>
              <SelectItem value="NOT_YET_RECRUITING">Starting Soon</SelectItem>
              <SelectItem value="ACTIVE_NOT_RECRUITING">Active</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All Phases</SelectItem>
              <SelectItem value="PHASE1">Phase 1</SelectItem>
              <SelectItem value="PHASE2">Phase 2</SelectItem>
              <SelectItem value="PHASE3">Phase 3</SelectItem>
              <SelectItem value="PHASE4">Phase 4</SelectItem>
              <SelectItem value="NA">N/A</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="INTERVENTIONAL">Interventional</SelectItem>
              <SelectItem value="OBSERVATIONAL">Observational</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm font-medium text-muted-foreground">
          {filtered.length} trial{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">No trials match your filters.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((t) => (
            <TrialCard
              key={t.nct}
              trial={t}
              expanded={expandedNct === t.nct}
              onToggle={() => setExpandedNct(expandedNct === t.nct ? null : t.nct)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

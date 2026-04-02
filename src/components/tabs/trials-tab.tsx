import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { Trial } from "@/lib/types"
import { categoryForTrial, statusLabel, phaseLabel, CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/types"

interface TrialsTabProps {
  trials: Trial[]
  loading: boolean
  error: string | null
  isFallback: boolean
}

const STATUS_BADGE_VARIANT: Record<string, string> = {
  RECRUITING: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  NOT_YET_RECRUITING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  ACTIVE_NOT_RECRUITING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
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
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">Active Clinical Trials</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All cluster headache trials currently recruiting, active, or starting soon — fetched live from ClinicalTrials.gov
        </p>
      </div>

      {isFallback && error && (
        <Alert className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertDescription className="text-sm text-amber-800 dark:text-amber-300">
            Showing cached data — live fetch failed ({error}). Refresh to retry.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search trials by title, sponsor, intervention…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="RECRUITING">Recruiting</SelectItem>
            <SelectItem value="NOT_YET_RECRUITING">Starting Soon</SelectItem>
            <SelectItem value="ACTIVE_NOT_RECRUITING">Active</SelectItem>
          </SelectContent>
        </Select>
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Phases</SelectItem>
            <SelectItem value="PHASE1">Phase 1</SelectItem>
            <SelectItem value="PHASE2">Phase 2</SelectItem>
            <SelectItem value="PHASE3">Phase 3</SelectItem>
            <SelectItem value="PHASE4">Phase 4</SelectItem>
            <SelectItem value="NA">N/A (Obs.)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="INTERVENTIONAL">Interventional</SelectItem>
            <SelectItem value="OBSERVATIONAL">Observational</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">{filtered.length} trial{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">NCT ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead className="w-[90px]">Phase</TableHead>
              <TableHead>Sponsor</TableHead>
              <TableHead className="w-[50px] text-right">N</TableHead>
              <TableHead className="w-[100px]">Est. End</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No trials match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => {
                const cat = categoryForTrial(t)
                const isExpanded = expandedNct === t.nct
                return (
                  <TableRow key={t.nct}>
                    <TableCell>
                      <a
                        href={`https://clinicaltrials.gov/study/${t.nct}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary hover:underline"
                      >
                        {t.nct}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`mb-1 text-[0.68rem] ${CATEGORY_COLORS[cat]}`}>
                        {CATEGORY_LABELS[cat]}
                      </Badge>
                      <br />
                      <span className="text-sm" title={t.title}>
                        {t.title.length > 80 ? t.title.slice(0, 78) + "…" : t.title}
                      </span>
                      {t.summary && t.summary.length > 20 && (
                        <>
                          <Button
                            variant="link"
                            size="sm"
                            className="ml-1 h-auto p-0 text-xs"
                            onClick={() => setExpandedNct(isExpanded ? null : t.nct)}
                          >
                            {isExpanded ? <ChevronDown className="mr-0.5" /> : <ChevronRight className="mr-0.5" />}
                            Details
                          </Button>
                          {isExpanded && (
                            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                              {t.summary.slice(0, 400)}{t.summary.length > 400 ? "…" : ""}
                            </p>
                          )}
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_BADGE_VARIANT[t.status] || ""}>
                        {statusLabel(t.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {phaseLabel(t.phase) !== "—" ? (
                        <Badge variant="outline" className="text-xs">{phaseLabel(t.phase)}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{t.sponsor}</TableCell>
                    <TableCell className="text-right text-sm">{String(t.enrollment)}</TableCell>
                    <TableCell className="text-sm">{t.end || "—"}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

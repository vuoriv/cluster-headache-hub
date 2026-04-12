import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  FlaskConical,
  Loader2,
  MessageCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { useDataDb, type PipelineRun, type Subcategory } from "@/lib/data-db"

// ── Helpers ──

function formatDuration(start: string, end: string | null): string {
  const endTime = end ? new Date(end).getTime() : Date.now()
  const startTime = new Date(start).getTime()
  const seconds = Math.floor((endTime - startTime) / 1000)
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function isCrashed(run: PipelineRun): boolean {
  if (run.status !== "running") return false
  const startedMs = new Date(run.startedAt).getTime()
  return Date.now() - startedMs > 60 * 60 * 1000
}

function effectiveStatus(run: PipelineRun): "success" | "failure" | "running" | "crashed" {
  if (isCrashed(run)) return "crashed"
  return run.status
}

function StatusBadge({ status }: { status: ReturnType<typeof effectiveStatus> }) {
  if (status === "success") {
    return (
      <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/10">
        <CheckCircle2 className="size-3" /> success
      </Badge>
    )
  }
  if (status === "failure") {
    return (
      <Badge className="gap-1 bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/10">
        <XCircle className="size-3" /> failure
      </Badge>
    )
  }
  if (status === "crashed") {
    return (
      <Badge className="gap-1 bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/10">
        <AlertTriangle className="size-3" /> crashed
      </Badge>
    )
  }
  return (
    <Badge className="gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10">
      <Loader2 className="size-3 animate-spin" /> running
    </Badge>
  )
}

// ── Page ──

export function DiagnosticsPage() {
  const { loading, getPipelineRuns, getAnalysisCoverage, getAnalysisErrors, getDataFreshness, getSubcategories, getCategories } = useDataDb()

  const runs = useMemo(() => (loading ? [] : getPipelineRuns()), [loading, getPipelineRuns])
  const coverage = useMemo(() => (loading ? null : getAnalysisCoverage()), [loading, getAnalysisCoverage])
  const errors = useMemo(() => (loading ? [] : getAnalysisErrors()), [loading, getAnalysisErrors])
  const freshness = useMemo(() => (loading ? null : getDataFreshness()), [loading, getDataFreshness])
  const categories = useMemo(() => (loading ? [] : getCategories()), [loading, getCategories])

  const lastRun = runs[0] ?? null
  const lastStatus = lastRun ? effectiveStatus(lastRun) : null

  const [expandedRun, setExpandedRun] = useState<string | null>(null)

  const aiCoveragePct = coverage && coverage.totalPapers > 0
    ? Math.round((coverage.aiAnalyzed / coverage.totalPapers) * 100)
    : 0
  const regexPct = coverage && coverage.totalPapers > 0
    ? Math.round((coverage.regexOnly / coverage.totalPapers) * 100)
    : 0
  const trialCoveragePct = coverage && coverage.totalTrials > 0
    ? Math.round((coverage.aiTrials / coverage.totalTrials) * 100)
    : 0

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold">Pipeline Diagnostics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Data pipeline health, coverage, and run history
        </p>
      </div>

      {/* Last Run Status */}
      {lastRun && (
        <Card className={lastStatus === "failure" || lastStatus === "crashed" ? "border-l-4 border-l-red-400" : lastStatus === "success" ? "border-l-4 border-l-green-400" : "border-l-4 border-l-blue-400"}>
          <CardContent className="flex flex-col gap-3 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Last Run</span>
              </div>
              {lastStatus && <StatusBadge status={lastStatus} />}
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                Started {timeAgo(lastRun.startedAt)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                Duration: {formatDuration(lastRun.startedAt, lastRun.finishedAt)}
              </span>
              {lastRun.trigger && (
                <span>Trigger: <span className="font-medium text-foreground">{lastRun.trigger}</span></span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>{lastRun.papersAnalyzed} papers analyzed</span>
              <span>{lastRun.trialsAnalyzed} trials analyzed</span>
              {lastRun.forumPostsAnalyzed > 0 && <span>{lastRun.forumPostsAnalyzed} forum posts analyzed</span>}
            </div>
            {lastRun.errorMessage && (
              <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-600 font-mono break-all">
                {lastRun.errorMessage}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      {coverage && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-3">
              <FileText className="size-4 text-muted-foreground mb-1" />
              <span className="text-xl font-bold tabular-nums text-primary">{coverage.totalPapers.toLocaleString()}</span>
              <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Total Papers</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-3">
              <Activity className="size-4 text-muted-foreground mb-1" />
              <span className="text-xl font-bold tabular-nums text-primary">{aiCoveragePct}%</span>
              <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">AI Coverage</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-3">
              <FlaskConical className="size-4 text-muted-foreground mb-1" />
              <span className="text-xl font-bold tabular-nums text-primary">{coverage.totalTrials.toLocaleString()}</span>
              <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Total Trials</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-3">
              <AlertTriangle className="size-4 text-muted-foreground mb-1" />
              <span className={`text-xl font-bold tabular-nums ${coverage.errorCount > 0 ? "text-red-500" : "text-primary"}`}>{coverage.errorCount}</span>
              <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Errors</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analysis Coverage */}
      {coverage && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Analysis Coverage</h3>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>AI analyzed papers</span>
                <span>{coverage.aiAnalyzed.toLocaleString()} / {coverage.totalPapers.toLocaleString()} ({aiCoveragePct}%)</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${aiCoveragePct}%` }} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Regex-only papers</span>
                <span>{coverage.regexOnly.toLocaleString()} / {coverage.totalPapers.toLocaleString()} ({regexPct}%)</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${regexPct}%` }} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>AI analyzed trials</span>
                <span>{coverage.aiTrials.toLocaleString()} / {coverage.totalTrials.toLocaleString()} ({trialCoveragePct}%)</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${trialCoveragePct}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <Separator />

      {/* Data Freshness */}
      {freshness && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Data Freshness</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 py-3">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Newest Paper</p>
                  <p className="text-sm font-semibold">{freshness.newestPaperDate ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 py-3">
                <FlaskConical className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Newest Trial</p>
                  <p className="text-sm font-semibold">{freshness.newestTrialDate ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 py-3">
                <Database className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Last Pipeline Run</p>
                  <p className="text-sm font-semibold">{freshness.lastRunAt ? timeAgo(freshness.lastRunAt) : "—"}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Separator />

      {/* Run History */}
      {runs.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Run History</h3>
          <div className="flex flex-col gap-2">
            {runs.map((run) => {
              const status = effectiveStatus(run)
              const isExpanded = expandedRun === run.runId
              return (
                <Card key={run.runId} className="overflow-hidden">
                  <button
                    className="w-full text-left"
                    onClick={() => setExpandedRun(isExpanded ? null : run.runId)}
                  >
                    <CardContent className="flex items-center gap-3 py-3">
                      {isExpanded ? (
                        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <StatusBadge status={status} />
                      <span className="flex-1 text-xs text-muted-foreground">{run.startedAt.slice(0, 19).replace("T", " ")}</span>
                      <span className="text-xs text-muted-foreground">{formatDuration(run.startedAt, run.finishedAt)}</span>
                      <span className="text-xs text-muted-foreground">{run.papersAnalyzed}p / {run.trialsAnalyzed}t</span>
                    </CardContent>
                  </button>
                  {isExpanded && (
                    <div className="border-t px-4 pb-4 pt-3 flex flex-col gap-3">
                      {run.phasesCompleted.length > 0 && (
                        <div>
                          <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Phases Completed</p>
                          <div className="flex flex-wrap gap-1">
                            {run.phasesCompleted.map((phase) => (
                              <Badge key={phase} variant="outline" className="text-[0.6rem]">{phase}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {run.errorMessage && (
                        <div>
                          <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Error</p>
                          <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-600 font-mono break-all">
                            {run.errorMessage}
                          </div>
                        </div>
                      )}
                      {run.log && (
                        <div>
                          <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Log</p>
                          <pre className="max-h-48 overflow-y-auto rounded-md bg-muted px-3 py-2 text-[0.65rem] text-muted-foreground whitespace-pre-wrap break-all">
                            {run.log}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      )}

      <Separator />

      {/* Error Log */}
      {errors.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 text-red-500" />
            Error Log
            <Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/10">{errors.length}</Badge>
          </h3>
          <div className="flex flex-col gap-2">
            {errors.map((err) => (
              <Card key={err.id} className="border-l-2 border-l-red-400">
                <CardContent className="flex flex-col gap-1.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {err.id.startsWith("PMID") || /^\d+$/.test(err.id) ? (
                        <a
                          href={`https://pubmed.ncbi.nlm.nih.gov/${err.id.replace(/\D/g, "")}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono font-semibold text-primary hover:underline"
                        >
                          {err.id}
                        </a>
                      ) : (
                        <span className="text-xs font-mono font-semibold">{err.id}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[0.65rem] text-muted-foreground">
                      {err.retryCount > 0 && <span>{err.retryCount} retries</span>}
                      <span>{timeAgo(err.timestamp)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground break-all">{err.error}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {errors.length === 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="size-4 text-green-500" />
            Error Log
          </h3>
          <p className="text-sm text-muted-foreground">No analysis errors recorded.</p>
        </div>
      )}

      <Separator />

      {/* Subcategory Summary */}
      {categories.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <MessageCircle className="size-4 text-muted-foreground" />
            Subcategory Summary
          </h3>
          <div className="flex flex-col gap-4">
            {categories.map((cat) => (
              <SubcategorySection key={cat} category={cat} getSubcategories={getSubcategories} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SubcategorySection({
  category,
  getSubcategories,
}: {
  category: string
  getSubcategories: (category: string) => Subcategory[]
}) {
  const subs = useMemo(() => getSubcategories(category), [category, getSubcategories])
  if (subs.length === 0) return null
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category}</h4>
      <div className="flex flex-wrap gap-1.5">
        {subs.map((sub) => (
          <Badge key={sub.term} variant="outline" className="text-[0.6rem] gap-1">
            {sub.term}
            <span className="text-muted-foreground">{sub.paperCount + sub.trialCount}</span>
          </Badge>
        ))}
      </div>
    </div>
  )
}

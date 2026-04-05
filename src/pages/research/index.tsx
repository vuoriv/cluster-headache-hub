import { useMemo } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useDataDb } from "@/lib/data-db"
import {
  BookOpen,
  FlaskConical,
  BarChart3,
  TrendingUp,
  ArrowRight,
  FileText,
  Users,
} from "lucide-react"

const SUB_PAGES = [
  {
    to: "papers",
    title: "All Papers",
    description: "Search and browse 4,400+ cluster headache publications from PubMed, categorized and scored for relevance.",
    icon: BookOpen,
    accent: "text-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400",
  },
  {
    to: "trials",
    title: "Active Trials",
    description: "Currently recruiting clinical trials with status, phase, and intervention details from ClinicalTrials.gov.",
    icon: FlaskConical,
    accent: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  {
    to: "insights/landscape",
    title: "Research Landscape",
    description: "What's being studied? Study types, categories, and research volume over time.",
    icon: BarChart3,
    accent: "text-purple-500 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400",
  },
  {
    to: "insights/evidence",
    title: "Evidence Dashboard",
    description: "Success vs failure rates by treatment. Where is the evidence strong vs weak?",
    icon: TrendingUp,
    accent: "text-amber-500 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400",
  },
] as const

export function ResearchIndex() {
  const { loading, getMeta, getActiveTrials } = useDataDb()

  const stats = useMemo(() => {
    if (loading) return null
    const meta = getMeta()
    const active = getActiveTrials()
    return {
      papers: meta?.paperCount ?? 0,
      trials: meta?.trialCount ?? 0,
      activeTrials: active.length,
      recruiting: active.filter((t) => t.status === "RECRUITING").length,
    }
  }, [loading, getMeta, getActiveTrials])

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold">Research</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Clinical trials, peer-reviewed papers, and evidence analysis from{" "}
          <a href="https://pubmed.ncbi.nlm.nih.gov" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground/70 hover:underline">PubMed</a>
          {" "}and{" "}
          <a href="https://clinicaltrials.gov" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground/70 hover:underline">ClinicalTrials.gov</a>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {loading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[80px] rounded-xl" />
          ))
        ) : (
          <>
            <StatCard icon={<FileText className="size-4" />} value={stats.papers.toLocaleString()} label="Papers" />
            <StatCard icon={<FlaskConical className="size-4" />} value={stats.trials} label="Total Trials" />
            <StatCard icon={<Users className="size-4" />} value={stats.activeTrials} label="Active Trials" />
            <StatCard icon={<TrendingUp className="size-4" />} value={stats.recruiting} label="Recruiting" />
          </>
        )}
      </div>

      {/* Sub-page cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {SUB_PAGES.map(({ to, title, description, icon: Icon, accent }) => (
          <Link key={to} to={to} className="group">
            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
              <CardContent className="flex h-full flex-col gap-3 pt-5">
                <div className={`flex size-10 items-center justify-center rounded-lg ${accent}`}>
                  <Icon className="size-5" />
                </div>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
                <div className="flex items-center justify-end border-t pt-3">
                  <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Explore <ArrowRight className="size-3" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Data source note */}
      <Card className="border-l-4 border-l-primary/30">
        <CardContent className="py-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Paper data from PubMed using expanded search: MeSH terms + title/abstract + "trigeminal autonomic cephalalgia".
            Trial data from ClinicalTrials.gov API. Data refreshed periodically via pipeline.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-[0.65rem] font-medium uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-xl font-bold tabular-nums tracking-tight">{value}</span>
      </CardContent>
    </Card>
  )
}

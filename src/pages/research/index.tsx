import { useMemo } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
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
  Pill,
  Syringe,
  Zap,
  Wind,
  Sun,
  Brain,
  Sparkles,
  ClipboardList,
} from "lucide-react"

const CATEGORIES = [
  { slug: "psychedelic", name: "Psychedelic Treatments", papers: 58, description: "Psilocybin, LSD, BOL-148. Community's top-rated treatments, now in Phase 2 trials.", icon: Sparkles, accent: "text-purple-500 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400" },
  { slug: "cgrp", name: "CGRP Therapies", papers: 227, description: "Galcanezumab, erenumab, gepants. The newest class of approved CH treatments.", icon: Brain, accent: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 dark:text-cyan-400" },
  { slug: "oxygen", name: "Oxygen Therapy", papers: 274, description: "High-flow O2 — the #1 abortive. 78% efficacy, zero side effects.", icon: Wind, accent: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400" },
  { slug: "pharmacology", name: "Pharmacological Treatments", papers: 364, description: "Verapamil, lithium, prednisone, melatonin, triptans. The medical toolkit.", icon: Pill, accent: "text-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400" },
  { slug: "nerve-block", name: "Nerve Blocks & Injections", papers: 501, description: "Occipital nerve blocks, SPG blocks, botulinum toxin. Procedural treatments.", icon: Syringe, accent: "text-amber-500 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400" },
  { slug: "neuromodulation", name: "Neuromodulation", papers: 350, description: "Vagus nerve stimulation, occipital stimulation, deep brain stimulation.", icon: Zap, accent: "text-rose-500 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400" },
  { slug: "non-pharma", name: "Non-Pharma Approaches", papers: 220, description: "Light therapy, exercise, acupuncture, behavioral approaches.", icon: Sun, accent: "text-orange-500 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-400" },
  { slug: "observational", name: "Observational Studies", papers: 478, description: "Epidemiology, patient registries, surveys. Understanding CH patterns.", icon: ClipboardList, accent: "text-slate-500 bg-slate-50 dark:bg-slate-950/40 dark:text-slate-400" },
] as const

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

      {/* Browse by Category */}
      <Separator />
      <div>
        <h3 className="mb-4 text-lg font-semibold">Browse by Category</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map(({ slug, name, papers, description, icon: Icon, accent }) => (
            <Link key={slug} to={`category/${slug}`} className="group">
              <Card className="h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
                <CardContent className="flex h-full flex-col gap-3 pt-5">
                  <div className={`flex size-10 items-center justify-center rounded-lg ${accent}`}>
                    <Icon className="size-5" />
                  </div>
                  <h4 className="text-base font-semibold">{name}</h4>
                  <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-xs font-medium text-muted-foreground">{papers} papers</span>
                    <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Explore <ArrowRight className="size-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
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

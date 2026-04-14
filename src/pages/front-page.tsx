import { useMemo } from "react"
import { Link } from "react-router-dom"
import {
  MessageCircle,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  Users,
  FileText,
  FlaskConical,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useDataDb } from "@/lib/data-db"

export function FrontPage() {
  const { loading, getMeta, getForumStats, getActiveTrials } = useDataDb()

  const stats = useMemo(() => {
    if (loading) return null
    const meta = getMeta()
    const forum = getForumStats()
    const active = getActiveTrials()
    const recruiting = active.filter((t) => t.status === "RECRUITING").length

    return {
      papers: meta?.paperCount ?? 0,
      activeTrials: active.length,
      recruiting,
      forumPosts: forum?.total_posts_cleaned ?? 0,
      forumTopics: forum?.total_topics ?? 0,
    }
  }, [loading, getMeta, getForumStats, getActiveTrials])

  return (
    <div className="flex flex-col gap-12">
      {/* Hero */}
      <section className="relative">
        <div className="max-w-3xl">
          <Badge variant="secondary" className="mb-4 text-xs font-medium tracking-wide">
            Open Research Platform
          </Badge>
          <h2 className="font-heading text-4xl leading-[1.15] tracking-tight sm:text-5xl">
            The most painful condition known to medicine
            <span className="text-muted-foreground"> — explored through data.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Cluster headaches affect roughly 1 in 1,000 people with attacks so severe
            they are called "suicide headaches." Standard medicine often fails these patients.
            This platform combines clinical trial data, peer-reviewed research, and
            real patient community experience to surface what actually works.
          </p>
        </div>
      </section>

      {/* Live Stats */}
      <section>
        <div className="grid grid-cols-3 gap-3">
          {loading || !stats ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-xl" />
            ))
          ) : (
            <>
              <StatCard
                to="/research/trials"
                value={stats.activeTrials}
                label="Active Trials"
                sublabel={`${stats.recruiting} recruiting`}
                icon={<FlaskConical className="size-4" />}
              />
              <StatCard
                to="/research"
                value={stats.papers.toLocaleString()}
                label="Research Papers"
                sublabel="From PubMed"
                icon={<FileText className="size-4" />}
              />
              <StatCard
                to="/clusterbusters"
                value={stats.forumPosts.toLocaleString()}
                label="Forum Analysis"
                sublabel={`${stats.forumTopics.toLocaleString()} topics`}
                icon={<Users className="size-4" />}
              />
            </>
          )}
        </div>
      </section>

      {/* Section Cards */}
      <section>
        <h3 className="mb-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Explore
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <SectionCard
            to="/clusterbusters"
            icon={<MessageCircle className="size-5" />}
            title="ClusterBusters"
            description="40,000+ forum posts analyzed with NLP to extract real patient treatment outcomes, ranked by effectiveness."
            stat={stats ? `${stats.forumPosts.toLocaleString()} posts` : undefined}
            accent="purple"
            loading={loading}
          />
          <SectionCard
            to="/research"
            icon={<BookOpen className="size-5" />}
            title="Research"
            description="4,400+ papers from PubMed, 100+ clinical trials, deep evidence analysis, and active trial tracking."
            stat={stats ? `${stats.papers.toLocaleString()} papers + ${stats.activeTrials} trials` : undefined}
            accent="blue"
            loading={loading}
          />
        </div>
      </section>

      <Separator />

      {/* Patient Perspective */}
      <section>
        <Card className="overflow-hidden border-l-4 border-l-amber-500 dark:border-l-amber-400">
          <CardContent className="flex gap-4 pt-5">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500 dark:text-amber-400" />
            <div>
              <h3 className="text-sm font-semibold">The treatment gap</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Many standard preventive medications — verapamil, lithium, topiramate —
                have limited effectiveness for cluster headache patients. Meanwhile,
                oxygen therapy, vitamin D3 protocols, and psychedelic "busting" show strong
                outcomes in both patient reports and emerging research. This platform
                highlights this gap by presenting community-validated data alongside
                clinical evidence.
              </p>
              <Link
                to="/clusterbusters"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                See the community evidence <ArrowRight className="size-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

    </div>
  )
}

function StatCard({
  to,
  value,
  label,
  sublabel,
  icon,
}: {
  to: string
  value: string | number
  label: string
  sublabel: string
  icon: React.ReactNode
}) {
  return (
    <Link to={to} className="group">
      <Card className="h-full transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
        <CardContent className="flex h-full flex-col gap-1 py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            {icon}
            <span className="text-[0.65rem] font-medium uppercase tracking-wider">
              {label}
            </span>
          </div>
          <span className="text-2xl font-bold tabular-nums tracking-tight">
            {value}
          </span>
          <span className="text-[0.65rem] text-muted-foreground">{sublabel}</span>
        </CardContent>
      </Card>
    </Link>
  )
}

const ACCENT_STYLES = {
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
} as const

function SectionCard({
  to,
  icon,
  title,
  description,
  stat,
  accent,
  loading,
}: {
  to: string
  icon: React.ReactNode
  title: string
  description: string
  stat?: string
  accent: keyof typeof ACCENT_STYLES
  loading: boolean
}) {
  return (
    <Link to={to} className="group">
      <Card className="h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
        <CardContent className="flex h-full flex-col gap-4 pt-5">
          <div
            className={`flex size-10 items-center justify-center rounded-lg ${ACCENT_STYLES[accent]}`}
          >
            {icon}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <h4 className="text-base font-semibold">{title}</h4>
            <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            {loading ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              <span className="text-xs font-medium text-muted-foreground">
                {stat}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Explore <ArrowRight className="size-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

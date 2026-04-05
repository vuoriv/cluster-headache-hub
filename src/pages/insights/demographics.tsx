import { useMemo } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Users, Crown, TrendingUp, Calendar } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useDataDb } from "@/lib/data-db"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { AreaChart, BarChart, Bar, XAxis, YAxis, CartesianGrid, Area } from "recharts"

interface DemographicsData {
  total_authors: number
  posts_per_year: Record<string, number>
  new_authors_per_year: Record<string, number>
  activity_distribution: Record<string, number>
  forum_activity: Record<string, number>
  power_users: Array<{ posts: number; years_active: number; forums: number }>
}

const postsPerYearConfig: ChartConfig = {
  posts: { label: "Posts", color: "oklch(0.65 0.15 250)" },
  newAuthors: { label: "New Authors", color: "oklch(0.7 0.15 160)" },
}

const activityConfig: ChartConfig = {
  count: { label: "Authors", color: "oklch(0.65 0.15 45)" },
}

const forumConfig: ChartConfig = {
  posts: { label: "Posts", color: "oklch(0.6 0.15 280)" },
}

export function DemographicsInsight() {
  const { loading, getInsight } = useDataDb()
  const data = getInsight<DemographicsData>("demographics")

  const postsChartData = useMemo(() => {
    if (!data) return []
    return Object.entries(data.posts_per_year)
      .map(([year, posts]) => ({
        year,
        posts,
        newAuthors: data.new_authors_per_year[year] ?? 0,
      }))
      .sort((a, b) => a.year.localeCompare(b.year))
  }, [data])

  const activityChartData = useMemo(() => {
    if (!data) return []
    return Object.entries(data.activity_distribution).map(([bucket, count]) => ({
      bucket,
      count,
    }))
  }, [data])

  const forumChartData = useMemo(() => {
    if (!data) return []
    return Object.entries(data.forum_activity)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([forum, posts]) => ({
        forum: forum.length > 30 ? forum.slice(0, 28) + "..." : forum,
        fullName: forum,
        posts,
      }))
  }, [data])

  const peakYear = useMemo(() => {
    if (!data) return null
    const entries = Object.entries(data.posts_per_year)
    if (entries.length === 0) return null
    return entries.reduce((max, curr) => (curr[1] > max[1] ? curr : max))
  }, [data])

  const powerUserCount = useMemo(() => {
    if (!data) return 0
    const dist = data.activity_distribution
    return (dist["21-100 posts"] ?? 0) + (dist["100+ posts"] ?? 0)
  }, [data])

  const avgPowerUserYears = useMemo(() => {
    if (!data || data.power_users.length === 0) return 0
    const total = data.power_users.reduce((sum, u) => sum + u.years_active, 0)
    return Math.round(total / data.power_users.length)
  }, [data])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          to="/clusterbusters/insights"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="size-4" />
          Back to Insights
        </Link>
        <p className="text-muted-foreground">Demographics data not available.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <Link
        to="/clusterbusters/insights"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="size-4" />
        Back to Insights
      </Link>

      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Community Demographics</h1>
        <p className="mt-2 text-lg text-muted-foreground leading-relaxed max-w-2xl">
          Most members post once and disappear. But{" "}
          <span className="font-semibold text-foreground">{powerUserCount} veterans</span>{" "}
          with 20+ posts are the backbone — their collective experience spans decades of
          cluster headache treatment knowledge.
        </p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.total_authors.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Unique Authors</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-purple-50 text-purple-500 dark:bg-purple-950/40 dark:text-purple-400">
              <Crown className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{powerUserCount}</p>
              <p className="text-xs text-muted-foreground">Power Users (20+ posts)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-400">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{peakYear?.[0] ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                Peak Year ({peakYear ? peakYear[1].toLocaleString() : "—"} posts)
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Calendar className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{avgPowerUserYears}+ yrs</p>
              <p className="text-xs text-muted-foreground">Avg Veteran Tenure</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Community Growth + Activity Distribution side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Community Growth Over Time</CardTitle>
            <CardDescription className="text-xs">
              Posts and new authors per year — from pioneers to thousands.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={postsPerYearConfig} className="h-[220px] w-full">
              <AreaChart data={postsChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="posts" stroke="var(--color-posts)" fill="var(--color-posts)" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="newAuthors" stroke="var(--color-newAuthors)" fill="var(--color-newAuthors)" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Lurkers vs Veterans</CardTitle>
            <CardDescription className="text-xs">
              Most post once in crisis. Repeat contributors carry institutional knowledge.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={activityConfig} className="h-[220px] w-full">
              <BarChart data={activityChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Forum Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Most Active Forum Sections</CardTitle>
          <p className="text-sm text-muted-foreground">
            Where the conversations happen. "Share Your Busting Stories" dominates — the
            community's core mission of documenting alternative treatment experiences drives
            the most discussion.
          </p>
        </CardHeader>
        <CardContent>
          <ChartContainer config={forumConfig} className="h-[400px] w-full">
            <BarChart data={forumChartData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="forum"
                width={180}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const item = payload?.[0]?.payload as
                        | { fullName?: string }
                        | undefined
                      return item?.fullName ?? String(payload?.[0]?.payload?.forum ?? "")
                    }}
                  />
                }
              />
              <Bar dataKey="posts" fill="var(--color-posts)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}

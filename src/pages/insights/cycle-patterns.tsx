import { useMemo } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Moon, Snowflake, TrendingUp, Calendar } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useDataDb } from "@/lib/data-db"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { BarChart, AreaChart, Bar, XAxis, YAxis, CartesianGrid, Area } from "recharts"

interface CyclePatternsData {
  seasonal: Array<{ month: string; posts: number }>
  hourly: Array<{ hour: number; posts: number }>
  weekly: Array<{ day: string; posts: number }>
  treatment_trends: Array<{ year: string; psychedelic: number; pharmaceutical: number }>
  peak_month: string
  peak_hour: number
}

const seasonalConfig: ChartConfig = {
  posts: { label: "Posts", color: "oklch(0.6 0.15 200)" },
}

const hourlyConfig: ChartConfig = {
  posts: { label: "Posts", color: "oklch(0.55 0.15 280)" },
}

const trendConfig: ChartConfig = {
  psychedelic: { label: "Psychedelic", color: "oklch(0.6 0.18 160)" },
  pharmaceutical: { label: "Pharmaceutical", color: "oklch(0.65 0.12 250)" },
}

export function CyclePatternsInsight() {
  const { loading, getInsight } = useDataDb()
  const data = getInsight<CyclePatternsData>("cycle-patterns")

  const hourlyChartData = useMemo(() => {
    if (!data) return []
    return data.hourly.map((item) => ({
      ...item,
      label: `${item.hour.toString().padStart(2, "0")}:00`,
    }))
  }, [data])

  const trendShiftYear = useMemo(() => {
    if (!data) return null
    const crossover = data.treatment_trends.find(
      (item) => item.psychedelic > item.pharmaceutical,
    )
    return crossover?.year ?? null
  }, [data])

  const peakHourFormatted = useMemo(() => {
    if (!data) return "—"
    const h = data.peak_hour
    if (h === 0) return "Midnight"
    if (h === 12) return "Noon"
    return h < 12 ? `${h} AM` : `${h - 12} PM`
  }, [data])

  const nightPostPercentage = useMemo(() => {
    if (!data) return 0
    const totalPosts = data.hourly.reduce((sum, h) => sum + h.posts, 0)
    const nightPosts = data.hourly
      .filter((h) => h.hour >= 22 || h.hour <= 5)
      .reduce((sum, h) => sum + h.posts, 0)
    return totalPosts > 0 ? Math.round((nightPosts / totalPosts) * 100) : 0
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
        <p className="text-muted-foreground">Cycle patterns data not available.</p>
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
        <h1 className="text-3xl font-bold tracking-tight">Cycle Patterns</h1>
        <p className="mt-2 text-lg text-muted-foreground leading-relaxed max-w-2xl">
          <span className="font-semibold text-foreground">{data.peak_month}</span> is the
          deadliest month for cluster headaches — posting spikes reveal when patients are
          suffering most. And{" "}
          {trendShiftYear ? (
            <>
              since{" "}
              <span className="font-semibold text-foreground">{trendShiftYear}</span>,
              psychedelic treatment discussions have overtaken pharmaceuticals.
            </>
          ) : (
            <>psychedelic treatment discussions continue to grow year over year.</>
          )}
        </p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-500 dark:bg-cyan-950/40 dark:text-cyan-400">
              <Snowflake className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.peak_month}</p>
              <p className="text-xs text-muted-foreground">Peak Month</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-purple-50 text-purple-500 dark:bg-purple-950/40 dark:text-purple-400">
              <Moon className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{peakHourFormatted}</p>
              <p className="text-xs text-muted-foreground">Peak Posting Hour</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-400">
              <Calendar className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{nightPostPercentage}%</p>
              <p className="text-xs text-muted-foreground">Night Posts (10PM-5AM)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{trendShiftYear ?? "Growing"}</p>
              <p className="text-xs text-muted-foreground">Psychedelic Crossover Year</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Seasonal + Hourly side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Seasonal Posting Patterns</CardTitle>
            <CardDescription className="text-xs">
              Forum activity mirrors real-world suffering — winter peak aligns with circadian disruptions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={seasonalConfig} className="aspect-[3/2] w-full">
              <BarChart data={data.seasonal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="posts" fill="var(--color-posts)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <Badge variant="info" className="mt-2">Peak: {data.peak_month}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Time-of-Day Activity</CardTitle>
            <CardDescription className="text-xs">
              "Alarm clock headaches" — patients wake in agony and reach for their phones.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={hourlyConfig} className="aspect-[3/2] w-full">
              <BarChart data={hourlyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={3} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="posts" fill="var(--color-posts)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Treatment Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Treatment Discussion Trends</CardTitle>
          <p className="text-sm text-muted-foreground">
            A paradigm shift captured in data. Psychedelic treatment discussions — primarily
            psilocybin and LSD — have steadily overtaken pharmaceutical discussions. This
            reflects a community that tried conventional medicine, found it lacking, and
            turned to alternatives backed by their own collective experience.
          </p>
        </CardHeader>
        <CardContent>
          <ChartContainer config={trendConfig} className="aspect-[16/9] w-full">
            <AreaChart data={data.treatment_trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="pharmaceutical"
                stackId="1"
                stroke="var(--color-pharmaceutical)"
                fill="var(--color-pharmaceutical)"
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="psychedelic"
                stackId="1"
                stroke="var(--color-psychedelic)"
                fill="var(--color-psychedelic)"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="success">Psychedelic</Badge>
            <Badge variant="info">Pharmaceutical</Badge>
            {trendShiftYear && (
              <Badge variant="secondary">
                Crossover: {trendShiftYear}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { CbOutcomeChart } from "./cb-outcome-chart"
import { CbDisclaimer } from "./cb-disclaimer"
import { TREATMENT_COLORS } from "@/lib/clusterbusters-types"
import { useForumDb } from "@/lib/forum-db"
import { ArrowLeft } from "lucide-react"

interface CbTreatmentDetailProps {
  slug: string
  onNavigate: (path: string) => void
}

const CATEGORY_BADGES: Record<string, { text: string; variant: "purple" | "info" | "warning" | "success" }> = {
  psychedelic: { text: "Psychedelic", variant: "purple" },
  acute: { text: "Acute", variant: "info" },
  conventional: { text: "Conventional", variant: "warning" },
  supportive: { text: "Supportive", variant: "success" },
}

export function CbTreatmentDetail({ slug, onNavigate }: CbTreatmentDetailProps) {
  const { loading, error, getTreatmentProfile } = useForumDb()

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return <div className="py-12 text-center text-destructive">Failed to load data: {error}</div>
  }

  const profile = getTreatmentProfile(slug)

  if (!profile) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-muted-foreground">Treatment not found.</p>
        <button className="text-sm text-primary underline" onClick={() => onNavigate("")}>
          Back to overview
        </button>
      </div>
    )
  }

  const badge = CATEGORY_BADGES[profile.category]
  const color = TREATMENT_COLORS[slug] ?? "var(--chart-1)"

  const timelineConfig: ChartConfig = {
    mentions: { label: "Mentions", color },
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink className="cursor-pointer" onClick={() => onNavigate("")}>
              ClusterBusters
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{profile.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => onNavigate("")}
            >
              <ArrowLeft className="size-4" />
            </button>
            <h2 className="text-2xl font-bold">{profile.name}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Community-reported outcomes from ClusterBusters forum data
          </p>
        </div>
        {badge && <Badge variant={badge.variant} className="mt-1">{badge.text}</Badge>}
      </div>

      <CbDisclaimer onNavigate={onNavigate} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <span className="text-2xl font-bold tabular-nums text-primary">
              {profile.stats.mentions.toLocaleString()}
            </span>
            <span className="text-center text-xs text-muted-foreground">Total Mentions</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <span className="text-2xl font-bold tabular-nums text-primary">
              {profile.stats.positiveRate}%
            </span>
            <span className="text-center text-xs text-muted-foreground">Positive Rate</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <span className="text-2xl font-bold tabular-nums text-primary">
              {profile.stats.peakYear}
            </span>
            <span className="text-center text-xs text-muted-foreground">Peak Year</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <span className="text-2xl font-bold tabular-nums text-primary">
              {profile.sampleSize.toLocaleString()}
            </span>
            <span className="text-center text-xs text-muted-foreground">Rated Posts</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {profile.protocol.dosing.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Protocol Guide</CardTitle>
              <CardDescription className="text-xs">Community-reported dosing and preparation</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {profile.protocol.dosing.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Dosing</p>
                  <ul className="mt-1 flex flex-col gap-1 text-sm">
                    {profile.protocol.dosing.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                </div>
              )}
              {profile.protocol.preparations.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Preparations</p>
                  <ul className="mt-1 flex flex-col gap-1 text-sm">
                    {profile.protocol.preparations.map((p) => <li key={p}>{p}</li>)}
                  </ul>
                </div>
              )}
              {profile.protocol.schedule.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Schedule</p>
                  <ul className="mt-1 flex flex-col gap-1 text-sm">
                    {profile.protocol.schedule.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <CbOutcomeChart outcomes={profile.outcomes} treatmentName={profile.name} />

        <Card className={profile.protocol.dosing.length > 0 ? "lg:col-span-2" : ""}>
          <CardHeader>
            <CardTitle className="text-sm">Discussion Timeline</CardTitle>
            <CardDescription className="text-xs">Forum mentions per year</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={timelineConfig} className="min-h-[200px] w-full">
              <AreaChart data={profile.timeline} margin={{ left: 0, right: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="year" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="mentions"
                  type="monotone"
                  fill={color}
                  stroke={color}
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {(profile.sideEffects.length > 0 || profile.contraindications.length > 0 || profile.coTreatments.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-3">
          {profile.sideEffects.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Side Effects</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {profile.sideEffects.map((s) => <li key={s}>- {s}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}
          {profile.contraindications.length > 0 && (
            <Card className="border-l-4 border-l-destructive">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Contraindications</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {profile.contraindications.map((c) => <li key={c}>- {c}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}
          {profile.coTreatments.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Commonly Used With</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {profile.coTreatments.map((ct) => (
                    <Badge key={ct} variant="secondary" className="text-xs">{ct}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

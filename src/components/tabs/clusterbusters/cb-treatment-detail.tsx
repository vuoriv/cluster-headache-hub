import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
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
import { useDataDb } from "@/lib/data-db"
import {
  ArrowLeft,
  Pill,
  Beaker,
  CalendarClock,
  AlertTriangle,
  Users,
} from "lucide-react"

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
  const { loading, error, getTreatmentProfile } = useDataDb()

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

  const hasProtocol = profile.protocol.dosing.length > 0 || profile.protocol.preparations.length > 0 || profile.protocol.schedule.length > 0

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
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

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Back to ClusterBusters"
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

      {/* Stats */}
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
              {(profile.stats.positiveRate * 100).toFixed(0)}%
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

      {/* Protocol (left, spans 2 rows) + Side Effects (top-right) + Co-Treatments (bottom-right) */}
      <div className="grid gap-6 lg:grid-cols-2 lg:grid-rows-[auto_auto]">
        {/* Protocol Guide — spans both rows */}
        {hasProtocol && (
          <Card className="lg:row-span-2">
            <CardHeader>
              <CardTitle className="text-sm">Protocol Guide</CardTitle>
              <CardDescription className="text-xs">
                Community-reported dosing and preparation
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {profile.protocol.dosing.length > 0 && (
                <ProtocolSection
                  icon={<Pill className="size-3.5" />}
                  title="Dosing"
                  items={profile.protocol.dosing}
                />
              )}
              {profile.protocol.preparations.length > 0 && (
                <ProtocolSection
                  icon={<Beaker className="size-3.5" />}
                  title="How to prepare"
                  items={profile.protocol.preparations}
                />
              )}
              {profile.protocol.schedule.length > 0 && (
                <ProtocolSection
                  icon={<CalendarClock className="size-3.5" />}
                  title="Schedule"
                  items={profile.protocol.schedule}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Side Effects — top-right */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="size-3.5 text-amber-500" />
              Side Effects
            </CardTitle>
            <CardDescription className="text-xs">
              Reported by community members
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profile.sideEffects.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {profile.sideEffects.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-400" />
                    <span className="text-muted-foreground">{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs italic text-muted-foreground/60">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Commonly Used With — bottom-right */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="size-3.5 text-primary" />
              Commonly Used With
            </CardTitle>
            <CardDescription className="text-xs">
              Treatments often combined by patients
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profile.coTreatments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.coTreatments.map((ct) => (
                  <Badge key={ct} variant="secondary" className="px-3 py-1 text-xs font-normal">
                    {ct}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground/60">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Charts — Outcomes + Timeline side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CbOutcomeChart outcomes={profile.outcomes} treatmentName={profile.name} />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Discussion Timeline</CardTitle>
            <CardDescription className="text-xs">Forum mentions per year</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={timelineConfig} className="h-[160px] w-full">
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
    </div>
  )
}

function ProtocolSection({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode
  title: string
  items: string[]
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </div>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/40" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

import { useMemo } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Heart, Users, Scale, AlertCircle } from "lucide-react"
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
import { PieChart, BarChart, Bar, XAxis, YAxis, CartesianGrid, Pie, Cell } from "recharts"

interface GenderCaregiversData {
  total_caregiver_posts: number
  patient_gender_estimate: { male: number; female: number; unknown: number }
  gender_ratio: number
  caregiver_relationships: Array<{ type: string; count: number }>
  caregiver_top_concerns: Array<{ concern: string; count: number }>
  caregiver_treatments_discussed: Array<{ treatment: string; count: number }>
  patient_treatments_discussed: Array<{ treatment: string; count: number }>
}

const GENDER_COLORS = [
  "oklch(0.6 0.15 250)",  // male - blue
  "oklch(0.65 0.15 350)", // female - pink
  "oklch(0.7 0.05 250)",  // unknown - gray-blue
]

const genderConfig: ChartConfig = {
  male: { label: "Male", color: GENDER_COLORS[0] },
  female: { label: "Female", color: GENDER_COLORS[1] },
  unknown: { label: "Unknown", color: GENDER_COLORS[2] },
}

const relationshipConfig: ChartConfig = {
  count: { label: "Posts", color: "oklch(0.6 0.15 350)" },
}

const concernConfig: ChartConfig = {
  count: { label: "Posts", color: "oklch(0.6 0.12 30)" },
}

const treatmentCompareConfig: ChartConfig = {
  caregiver: { label: "Caregiver Posts", color: "oklch(0.65 0.15 350)" },
  patient: { label: "Patient Posts", color: "oklch(0.6 0.15 250)" },
}

export function GenderCaregiversInsight() {
  const { loading, getInsight } = useDataDb()
  const data = getInsight<GenderCaregiversData>("gender-caregivers")

  const genderPieData = useMemo(() => {
    if (!data) return []
    return [
      { name: "Male", value: data.patient_gender_estimate.male, fill: GENDER_COLORS[0] },
      { name: "Female", value: data.patient_gender_estimate.female, fill: GENDER_COLORS[1] },
      { name: "Unknown", value: data.patient_gender_estimate.unknown, fill: GENDER_COLORS[2] },
    ]
  }, [data])

  const treatmentCompareData = useMemo(() => {
    if (!data) return []
    const caregiverMap = new Map(
      data.caregiver_treatments_discussed.map((t) => [t.treatment, t.count]),
    )
    const patientMap = new Map(
      data.patient_treatments_discussed.map((t) => [t.treatment, t.count]),
    )

    const allTreatments = new Set([
      ...data.caregiver_treatments_discussed.map((t) => t.treatment),
      ...data.patient_treatments_discussed.map((t) => t.treatment),
    ])

    return Array.from(allTreatments)
      .map((treatment) => ({
        treatment,
        caregiver: caregiverMap.get(treatment) ?? 0,
        patient: patientMap.get(treatment) ?? 0,
        total: (caregiverMap.get(treatment) ?? 0) + (patientMap.get(treatment) ?? 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [data])

  const topConcern = useMemo(() => {
    if (!data || data.caregiver_top_concerns.length === 0) return null
    return data.caregiver_top_concerns[0]
  }, [data])

  const knownGenderTotal = useMemo(() => {
    if (!data) return 0
    return data.patient_gender_estimate.male + data.patient_gender_estimate.female
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
        <p className="text-muted-foreground">Gender & caregiver data not available.</p>
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
        <h1 className="text-3xl font-bold tracking-tight">Gender & Caregivers</h1>
        <p className="mt-2 text-lg text-muted-foreground leading-relaxed max-w-2xl">
          The{" "}
          <span className="font-semibold text-foreground">
            {data.gender_ratio}:1 male-to-female ratio
          </span>{" "}
          challenges the clinical "3:1 male" dogma. And{" "}
          <span className="font-semibold text-foreground">
            {data.total_caregiver_posts.toLocaleString()} caregiver posts
          </span>{" "}
          reveal the hidden burden — partners searching desperately for answers while
          watching their loved one suffer.
        </p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400">
              <Heart className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {data.total_caregiver_posts.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Caregiver Posts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-400">
              <Scale className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.gender_ratio}:1</p>
              <p className="text-xs text-muted-foreground">Male:Female Ratio</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{knownGenderTotal.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Gender-Identified Posts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-orange-50 text-orange-500 dark:bg-orange-950/40 dark:text-orange-400">
              <AlertCircle className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold truncate text-xl">
                {topConcern?.concern ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">Top Caregiver Concern</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Gender Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Patient Gender Estimate</CardTitle>
          <p className="text-sm text-muted-foreground">
            Clinical literature has long claimed a 3:1 male-to-female ratio for cluster
            headaches. This community data tells a different story. Women may be
            underdiagnosed, misdiagnosed with migraine, or simply less likely to appear in
            older clinical samples. A {data.gender_ratio}:1 ratio suggests the gap is far
            narrower than textbooks claim.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
            <ChartContainer config={genderConfig} className="h-[250px] w-[250px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={genderPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {genderPieData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex flex-col gap-3 pt-4">
              {genderPieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-3">
                  <div
                    className="size-3 rounded-full shrink-0"
                    style={{ backgroundColor: entry.fill }}
                  />
                  <span className="text-sm font-medium">{entry.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {entry.value.toLocaleString()} posts
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Caregiver Relationships */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Who Are the Caregivers?</CardTitle>
          <p className="text-sm text-muted-foreground">
            Behind every cluster headache patient is someone watching helplessly. These posts
            come from partners, parents, and friends — people who've watched someone they
            love writhe in pain and come to the forum looking for anything that might help.
          </p>
        </CardHeader>
        <CardContent>
          <ChartContainer config={relationshipConfig} className="aspect-[16/9] w-full">
            <BarChart data={data.caregiver_relationships}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Top Concerns + Treatment Comparison side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Caregiver Top Concerns</CardTitle>
            <CardDescription className="text-xs">
              Desperate questions from people trying to help someone survive the "suicide headache."
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={concernConfig} style={{ height: `${Math.min(data.caregiver_top_concerns.length, 5) * 40 + 40}px` }} className="w-full">
              <BarChart data={data.caregiver_top_concerns.slice(0, 5)} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="concern" width={110} tick={{ fontSize: 9 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Caregiver vs Patient Treatments</CardTitle>
            <CardDescription className="text-xs">
              Caregivers search for conventional options; patients gravitate to community-proven alternatives.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={treatmentCompareConfig} className="aspect-[4/3] w-full">
              <BarChart data={treatmentCompareData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="treatment" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="caregiver" fill="var(--color-caregiver)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="patient" fill="var(--color-patient)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="danger" className="text-[0.6rem]">Caregiver</Badge>
              <Badge variant="info" className="text-[0.6rem]">Patient</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

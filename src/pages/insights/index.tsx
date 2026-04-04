import { Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import {
  Users,
  Activity,
  ArrowRightLeft,
  BarChart3,
  Clock,
  Heart,
  ArrowRight,
} from "lucide-react"

const INSIGHTS = [
  {
    slug: "patient-journeys",
    title: "Patient Journeys",
    description: "1,486 returning users tracked across multiple years — cycle recurrence, remission gaps, and treatment evolution over time.",
    stat: "371 returned after remission",
    icon: Activity,
    accent: "text-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400",
  },
  {
    slug: "episodic-vs-chronic",
    title: "Episodic vs Chronic",
    description: "How treatment patterns differ between episodic and chronic cluster headache patients — and who responds better to what.",
    stat: "2,729 typed posts",
    icon: BarChart3,
    accent: "text-purple-500 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400",
  },
  {
    slug: "treatment-paths",
    title: "Treatment Paths",
    description: "What patients try first, what they switch to, and the journey from doctor-prescribed to community-discovered treatments.",
    stat: "1,108 tracked progressions",
    icon: ArrowRightLeft,
    accent: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  {
    slug: "demographics",
    title: "Community Demographics",
    description: "2,749 unique voices — who posts, how often, and how the community has grown over 16 years.",
    stat: "16 years of data",
    icon: Users,
    accent: "text-amber-500 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400",
  },
  {
    slug: "cycle-patterns",
    title: "Cycle Patterns",
    description: "Seasonal peaks, nocturnal posting spikes, and the year-over-year rise of psychedelic treatments vs pharmaceuticals.",
    stat: "Peak month: December",
    icon: Clock,
    accent: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 dark:text-cyan-400",
  },
  {
    slug: "gender-caregivers",
    title: "Gender & Caregivers",
    description: "1,540 caregiver posts analyzed — the hidden burden on partners and families, and what they search for most.",
    stat: "0.9:1 M:F ratio",
    icon: Heart,
    accent: "text-rose-500 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400",
  },
] as const

export function InsightsIndex() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold">Community Insights</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deep analytics from 40,000+ ClusterBusters forum posts spanning 2009–2026
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INSIGHTS.map(({ slug, title, description, stat, icon: Icon, accent }) => (
          <Link key={slug} to={slug} className="group">
            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
              <CardContent className="flex h-full flex-col gap-3 pt-5">
                <div className={`flex size-10 items-center justify-center rounded-lg ${accent}`}>
                  <Icon className="size-5" />
                </div>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-xs font-medium text-muted-foreground">{stat}</span>
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
  )
}

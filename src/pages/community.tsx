import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Globe,
  ExternalLink,
  MessageSquare,
  MessageCircle,
  Users,
  Heart,
} from "lucide-react"
import { cn } from "@/lib/utils"
import groups from "@/data/community-groups.json"

// Country flag emoji from ISO code
function flag(code: string): string {
  if (code === "INT") return "\uD83C\uDF0D"
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("")
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  website: <Globe className="size-4" />,
  facebook: <MessageSquare className="size-4" />,
  reddit: <MessageCircle className="size-4" />,
  discord: <MessageCircle className="size-4" />,
}

const PLATFORM_LABELS: Record<string, string> = {
  website: "Website",
  facebook: "Facebook",
  reddit: "Reddit",
  discord: "Discord",
  forum: "Forum",
}

const REGIONS = [
  { value: "all", label: "All Regions" },
  { value: "international", label: "International" },
  { value: "north-america", label: "North America" },
  { value: "europe", label: "Europe" },
  { value: "asia-pacific", label: "Asia-Pacific" },
  { value: "south-america", label: "South America" },
] as const

const PLATFORMS = [
  { value: "all", label: "All Platforms" },
  { value: "website", label: "Website" },
  { value: "facebook", label: "Facebook" },
  { value: "reddit", label: "Reddit" },
] as const

const REGION_LABELS: Record<string, string> = {
  international: "International",
  "north-america": "North America",
  europe: "Europe",
  "asia-pacific": "Asia-Pacific",
  "south-america": "South America",
}

interface Group {
  name: string
  country: string
  region: string
  platform: string
  url: string
  language: string
  description: string
  members: string | null
  tags: string[]
}

export function CommunityPage() {
  const [regionFilter, setRegionFilter] = useState("all")
  const [platformFilter, setPlatformFilter] = useState("all")

  const filtered = useMemo(() => {
    let result = groups as Group[]
    if (regionFilter !== "all") {
      result = result.filter((g) => g.region === regionFilter)
    }
    if (platformFilter !== "all") {
      result = result.filter((g) => g.platform === platformFilter)
    }
    return result
  }, [regionFilter, platformFilter])

  // Group by region for display
  const grouped = useMemo(() => {
    const map = new Map<string, Group[]>()
    const order = ["international", "north-america", "europe", "asia-pacific", "south-america"]
    for (const region of order) {
      const items = filtered.filter((g) => g.region === region)
      if (items.length > 0) map.set(region, items)
    }
    return map
  }, [filtered])

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold">Community Groups</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {groups.length} cluster headache patient support groups worldwide — organizations,
          forums, Facebook groups, and online communities
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-3">
            <span className="text-xl font-bold tabular-nums text-primary">{groups.length}</span>
            <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Groups</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-3">
            <span className="text-xl font-bold tabular-nums text-primary">
              {new Set((groups as Group[]).map((g) => g.country)).size}
            </span>
            <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Countries</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-3">
            <span className="text-xl font-bold tabular-nums text-primary">
              {new Set((groups as Group[]).map((g) => g.language)).size}
            </span>
            <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Languages</span>
          </CardContent>
        </Card>
      </div>

      {/* Region filters */}
      <div className="flex flex-wrap gap-1.5">
        <span className="mr-1 flex items-center text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Region</span>
        {REGIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setRegionFilter(value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              regionFilter === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Platform filters */}
      <div className="flex flex-wrap gap-1.5">
        <span className="mr-1 flex items-center text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Platform</span>
        {PLATFORMS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setPlatformFilter(value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              platformFilter === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Groups by region */}
      {grouped.size === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Users className="size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No groups match your filters</p>
        </div>
      ) : (
        Array.from(grouped).map(([region, regionGroups]) => (
          <div key={region}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Globe className="size-3.5" />
              {REGION_LABELS[region] ?? region}
              <span className="text-xs font-normal">({regionGroups.length})</span>
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {regionGroups.map((group) => (
                <GroupCard key={group.url} group={group} />
              ))}
            </div>
            <Separator className="mt-6" />
          </div>
        ))
      )}

      {/* Call to action */}
      <Card className="border-l-4 border-l-primary/30">
        <CardContent className="flex items-start gap-3 py-4">
          <Heart className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">Know a group we're missing?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              This directory is community-maintained. If you run or know of a CH patient group
              not listed here, please reach out so we can add it. The data file is open source
              and easy to update.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function GroupCard({ group }: { group: Group }) {
  const platformIcon = PLATFORM_ICONS[group.platform] ?? <Globe className="size-4" />

  return (
    <a
      href={group.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group"
    >
      <Card className="h-full transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
        <CardContent className="flex h-full flex-col gap-3 pt-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg" title={group.country}>
                {flag(group.country)}
              </span>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold leading-tight">{group.name}</h4>
              </div>
            </div>
            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground/40 group-hover:text-primary" />
          </div>

          {/* Description */}
          <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
            {group.description}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between border-t pt-2">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {platformIcon}
              <span className="text-[0.65rem]">{PLATFORM_LABELS[group.platform] ?? group.platform}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[0.6rem]">
                {group.language.toUpperCase()}
              </Badge>
              {group.members && (
                <span className="text-[0.6rem] text-muted-foreground">{group.members}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </a>
  )
}

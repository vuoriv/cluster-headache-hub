import { useState } from "react"
import { Brain } from "lucide-react"
import { cn } from "@/lib/utils"

interface HeaderProps {
  trialCount: number | null
  recruitingCount: number | null
  paperCount: number | null
  psychedelicCount: number | null
  loading: boolean
}

function StatItem({ value, label, loading }: { value: string | number | null; label: string; loading?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2.5 border-b border-primary-foreground/10 sm:border-b-0">
      <span className={cn("text-xl font-extrabold text-primary-foreground", loading && "animate-pulse opacity-40")}>
        {value ?? "—"}
      </span>
      <span className="text-[0.68rem] uppercase tracking-wide text-primary-foreground/70">{label}</span>
    </div>
  )
}

export function Header({ trialCount, recruitingCount, paperCount, psychedelicCount, loading }: HeaderProps) {
  const [loadTime] = useState(() => new Date().toLocaleString())

  return (
    <header>
      <div className="bg-primary px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-primary-foreground">
              <Brain className="size-7" aria-hidden="true" />
              Cluster Headache Research Hub
            </h1>
            <p className="mt-1 text-sm text-primary-foreground/70">
              Data from ClinicalTrials.gov &amp; PubMed — fetched live on every page load when available
            </p>
          </div>
          <div className="text-right text-xs text-primary-foreground/60">
            <strong className="block text-sm text-primary-foreground/80">{loadTime}</strong>
            <span>Data refreshed on load</span>
          </div>
        </div>
      </div>
      <div className="bg-primary/90 border-t border-primary-foreground/10 px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-2 sm:grid-cols-4 divide-primary-foreground/10 sm:divide-x">
          <StatItem value={trialCount} label="Active Trials" loading={loading} />
          <StatItem value={recruitingCount} label="Recruiting Now" loading={loading} />
          <StatItem value={paperCount} label="Papers (All Time)" loading={loading} />
          <StatItem value={psychedelicCount} label="Psychedelic Trials" loading={loading} />
        </div>
      </div>
    </header>
  )
}

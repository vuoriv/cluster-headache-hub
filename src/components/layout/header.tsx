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
    <div className="flex flex-col items-center gap-1 px-4 py-3">
      <span className={cn(
        "text-2xl font-extrabold tracking-tight text-primary-foreground tabular-nums",
        loading && "animate-pulse opacity-40"
      )}>
        {value ?? "—"}
      </span>
      <span className="text-[0.65rem] font-medium uppercase tracking-widest text-primary-foreground/60">{label}</span>
    </div>
  )
}

export function Header({ trialCount, recruitingCount, paperCount, psychedelicCount, loading }: HeaderProps) {
  const [loadTime] = useState(() => new Date().toLocaleString())

  return (
    <header className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[oklch(0.22_0.08_260)]" />
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
        backgroundSize: "24px 24px",
      }} />

      <div className="relative px-6 pt-8 pb-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-primary-foreground sm:text-3xl">
              <Brain className="size-7 sm:size-8 opacity-80" aria-hidden="true" />
              Cluster Headache Research Hub
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-primary-foreground/60">
              Live clinical trial data from ClinicalTrials.gov and research papers from PubMed — refreshed on every page load
            </p>
          </div>
          <div className="text-right text-xs text-primary-foreground/50">
            <strong className="block text-sm font-medium text-primary-foreground/70">{loadTime}</strong>
            <span>Data refreshed on load</span>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="relative border-t border-primary-foreground/8 px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-2 sm:grid-cols-4">
          <StatItem value={trialCount} label="Active Trials" loading={loading} />
          <StatItem value={recruitingCount} label="Recruiting" loading={loading} />
          <StatItem value={paperCount} label="Papers" loading={loading} />
          <StatItem value={psychedelicCount} label="Psychedelic Trials" loading={loading} />
        </div>
      </div>
    </header>
  )
}

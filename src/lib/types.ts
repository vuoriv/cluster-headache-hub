export interface Trial {
  nct: string
  title: string
  status: string
  phase: string[]
  type: string
  sponsor: string
  enrollment: number | string
  start: string
  end: string
  interventions: string
  summary: string
  conditions: string
}

export interface Paper {
  pmid: string
  title: string
  authors: string
  journal: string
  pubdate: string
  epubdate: string
}

export type TrialCategory =
  | "psychedelic"
  | "cgrp"
  | "oxygen"
  | "pharmacology"
  | "nerve-block"
  | "neuromodulation"
  | "non-pharma"
  | "observational"
  | "other"

export const CATEGORY_COLORS: Record<TrialCategory, string> = {
  psychedelic: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  cgrp: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  oxygen: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  pharmacology: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "nerve-block": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  neuromodulation: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  "non-pharma": "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
  observational: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400",
}

export const CATEGORY_LABELS: Record<TrialCategory, string> = {
  psychedelic: "Psychedelic",
  cgrp: "CGRP",
  oxygen: "Oxygen",
  pharmacology: "Pharmacology",
  "nerve-block": "Nerve Block",
  neuromodulation: "Neuromodulation",
  "non-pharma": "Non-Pharma",
  observational: "Observational",
  other: "Other",
}

export function categoryForTrial(t: Trial): TrialCategory {
  const txt = (t.title + " " + JSON.stringify(t.interventions || "")).toLowerCase()
  if (/psilocybin|lsd|lysergic|psychedel|ketamine|busting/.test(txt)) return "psychedelic"
  if (/cgrp|galcanezumab|erenumab|eptinezumab|fremanezumab|rimegepant|gepant/.test(txt)) return "cgrp"
  if (/oxygen|o2/.test(txt)) return "oxygen"
  if (/verapamil|lithium|melatonin|oxybate/.test(txt)) return "pharmacology"
  if (/botulinum|block|occipital|sphenopalatine|ganglion|nerve|spg|bupivacaine/.test(txt)) return "nerve-block"
  if (/stimul|neuromod|vagus|vns|primus/.test(txt)) return "neuromodulation"
  if (/light|yoga|mind|exercise|behavior/.test(txt)) return "non-pharma"
  if (/observ|registry|survey|epidemiol/.test(txt)) return "observational"
  return "other"
}

export function statusLabel(s: string): string {
  const map: Record<string, string> = {
    RECRUITING: "Recruiting",
    NOT_YET_RECRUITING: "Starting Soon",
    ACTIVE_NOT_RECRUITING: "Active",
    COMPLETED: "Completed",
  }
  return map[s] || s
}

export function phaseLabel(phases: string[]): string {
  if (!phases || !phases.length) return "—"
  return phases.map((p) => p.replace("PHASE", "Ph ").replace("EARLY_PHASE1", "Early Ph1")).join(", ")
}

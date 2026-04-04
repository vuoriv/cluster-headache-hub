type BadgeVariant = "purple" | "cyan" | "success" | "info" | "warning" | "amber" | "secondary" | "outline"

interface CategoryConfig {
  label: string
  variant: BadgeVariant
}

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  psychedelic: { label: "Psychedelic", variant: "purple" },
  cgrp: { label: "CGRP", variant: "cyan" },
  oxygen: { label: "Oxygen", variant: "success" },
  "vitamin-d": { label: "Vitamin D", variant: "amber" },
  pharmacology: { label: "Pharmacology", variant: "info" },
  "nerve-block": { label: "Nerve Block", variant: "warning" },
  neuromodulation: { label: "Neuromodulation", variant: "cyan" },
  "non-pharma": { label: "Non-Pharma", variant: "success" },
  observational: { label: "Observational", variant: "secondary" },
  other: { label: "Other", variant: "outline" },
}

export const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  RECRUITING: { label: "Recruiting", variant: "success" },
  NOT_YET_RECRUITING: { label: "Starting Soon", variant: "info" },
  ACTIVE_NOT_RECRUITING: { label: "Active", variant: "cyan" },
  COMPLETED: { label: "Completed", variant: "secondary" },
  TERMINATED: { label: "Terminated", variant: "outline" },
  WITHDRAWN: { label: "Withdrawn", variant: "outline" },
  SUSPENDED: { label: "Suspended", variant: "warning" },
}

export function phaseLabel(phases: string[]): string {
  if (!phases || !phases.length) return "—"
  return phases
    .map((p) => p.replace("PHASE", "Ph ").replace("EARLY_PHASE1", "Early Ph1"))
    .join(", ")
}

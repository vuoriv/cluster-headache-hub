import type {
  RawTrial,
  RawPaper,
  EnrichedTrial,
  EnrichedPaper,
  ResearchCategory,
} from "./types.js"

// Patient-community validated treatments get higher relevance
const CATEGORY_RELEVANCE: Record<ResearchCategory, number> = {
  psychedelic: 1.0,
  oxygen: 0.95,
  "vitamin-d": 0.9,
  cgrp: 0.7,
  "nerve-block": 0.6,
  neuromodulation: 0.6,
  pharmacology: 0.5,
  "non-pharma": 0.5,
  observational: 0.4,
  other: 0.3,
}

function categorizeText(text: string): ResearchCategory {
  const t = text.toLowerCase()

  if (/psilocybin|lsd|lysergic|psychedel|ketamine|busting|dmt|5-meo/.test(t))
    return "psychedelic"
  if (
    /cgrp|galcanezumab|erenumab|eptinezumab|fremanezumab|rimegepant|gepant|calcitonin.gene/.test(
      t,
    )
  )
    return "cgrp"
  if (/\boxygen\b|high.flow.o2|\bo2\b/.test(t)) return "oxygen"
  if (/vitamin.d|cholecalciferol|d3.regimen/.test(t)) return "vitamin-d"
  if (
    /verapamil|lithium|melatonin|oxybate|predniso|corticosteroid|topiramate|valproat/.test(
      t,
    )
  )
    return "pharmacology"
  if (
    /botulinum|block|occipital|sphenopalatine|ganglion|nerve.block|spg|bupivacaine/.test(
      t,
    )
  )
    return "nerve-block"
  if (/stimul|neuromod|vagus|vns|primus|deep.brain|non.invasive/.test(t))
    return "neuromodulation"
  if (/light|yoga|mind|exercise|behavior|acupuncture|biofeedback/.test(t))
    return "non-pharma"
  if (/observ|registry|survey|epidemiol|natural.history|cohort/.test(t))
    return "observational"

  return "other"
}

function computeTrialRelevance(trial: RawTrial, category: ResearchCategory): number {
  let score = CATEGORY_RELEVANCE[category]

  // Boost active/recruiting trials
  if (trial.status === "RECRUITING") score += 0.15
  else if (trial.status === "ACTIVE_NOT_RECRUITING") score += 0.1
  else if (trial.status === "NOT_YET_RECRUITING") score += 0.12
  else if (trial.status === "COMPLETED") score += 0.05

  // Boost later-phase trials
  if (trial.phase.some((p) => p.includes("3"))) score += 0.1
  else if (trial.phase.some((p) => p.includes("2"))) score += 0.05

  return Math.min(score, 1.0)
}

function computePaperRelevance(paper: RawPaper, category: ResearchCategory): number {
  let score = CATEGORY_RELEVANCE[category]

  // Boost papers with abstracts (more useful for search)
  if (paper.abstract) score += 0.05

  // Boost recent papers
  const year = parseInt(paper.pubDate)
  if (year >= 2023) score += 0.1
  else if (year >= 2020) score += 0.05

  return Math.min(score, 1.0)
}

export function enrichTrials(trials: RawTrial[]): EnrichedTrial[] {
  console.log("Enriching trials...")
  return trials.map((trial) => {
    const text = [trial.title, trial.summary, ...trial.interventions, ...trial.conditions].join(" ")
    const category = categorizeText(text)
    const relevanceScore = computeTrialRelevance(trial, category)
    return { ...trial, category, relevanceScore }
  })
}

export function enrichPapers(papers: RawPaper[]): EnrichedPaper[] {
  console.log("Enriching papers...")
  return papers.map((paper) => {
    const text = [paper.title, paper.abstract, ...paper.meshTerms].join(" ")
    const category = categorizeText(text)
    const relevanceScore = computePaperRelevance(paper, category)
    return { ...paper, category, relevanceScore }
  })
}

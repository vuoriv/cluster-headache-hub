export interface RawTrial {
  nctId: string
  title: string
  status: string
  phase: string[]
  studyType: string
  sponsor: string
  enrollment: number | null
  startDate: string
  endDate: string
  interventions: string[]
  summary: string
  conditions: string[]
  rawJson: string
}

export interface RawPaper {
  pmid: string
  title: string
  authors: string
  journal: string
  pubDate: string
  abstract: string
  meshTerms: string[]
}

export type ResearchCategory =
  | "psychedelic"
  | "cgrp"
  | "oxygen"
  | "pharmacology"
  | "nerve-block"
  | "neuromodulation"
  | "vitamin-d"
  | "non-pharma"
  | "observational"
  | "other"

export interface EnrichedTrial extends RawTrial {
  category: ResearchCategory
  relevanceScore: number
}

export interface EnrichedPaper extends RawPaper {
  category: ResearchCategory
  relevanceScore: number
}

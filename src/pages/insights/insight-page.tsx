import { useParams, Navigate } from "react-router-dom"
import { PatientJourneys } from "./patient-journeys"
import { EpisodicVsChronic } from "./episodic-vs-chronic"
import { TreatmentPaths } from "./treatment-paths"
import { DemographicsInsight } from "./demographics"
import { CyclePatternsInsight } from "./cycle-patterns"
import { GenderCaregiversInsight } from "./gender-caregivers"

const INSIGHT_COMPONENTS: Record<string, React.FC> = {
  "patient-journeys": PatientJourneys,
  "episodic-vs-chronic": EpisodicVsChronic,
  "treatment-paths": TreatmentPaths,
  "demographics": DemographicsInsight,
  "cycle-patterns": CyclePatternsInsight,
  "gender-caregivers": GenderCaregiversInsight,
}

export function InsightPage() {
  const { slug } = useParams<{ slug: string }>()
  if (!slug || !INSIGHT_COMPONENTS[slug]) {
    return <Navigate to="/clusterbusters/insights" replace />
  }
  const Component = INSIGHT_COMPONENTS[slug]
  return <Component />
}

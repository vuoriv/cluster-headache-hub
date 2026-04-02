import { useState, useEffect } from "react"
import type { Trial } from "@/lib/types"
import { STATIC_TRIALS } from "@/lib/static-trials"

interface TrialsState {
  trials: Trial[]
  loading: boolean
  error: string | null
  isFallback: boolean
}

export function useTrials(): TrialsState {
  const [state, setState] = useState<TrialsState>({
    trials: [],
    loading: true,
    error: null,
    isFallback: false,
  })

  useEffect(() => {
    async function load() {
      try {
        const statuses = "RECRUITING,NOT_YET_RECRUITING,ACTIVE_NOT_RECRUITING"
        const url = `https://clinicaltrials.gov/api/v2/studies?query.cond=cluster+headache&filter.overallStatus=${statuses}&pageSize=200&format=json`
        const res = await fetch(url)
        if (!res.ok) throw new Error("HTTP " + res.status)
        const data = await res.json()

        const trials: Trial[] = (data.studies || []).map((s: Record<string, Record<string, unknown>>) => {
          const p = (s.protocolSection || {}) as Record<string, Record<string, unknown>>
          const id = (p.identificationModule || {}) as Record<string, string>
          const stat = (p.statusModule || {}) as Record<string, unknown>
          const des = (p.designModule || {}) as Record<string, unknown>
          const sp = ((p.sponsorCollaboratorsModule || {}) as Record<string, Record<string, string>>).leadSponsor || {}
          const arms = (p.armsInterventionsModule || {}) as Record<string, Array<Record<string, string>>>
          const desc = (p.descriptionModule || {}) as Record<string, string>
          const cond = (p.conditionsModule || {}) as Record<string, string[]>

          const interventions = (arms.interventions || []).map((i) => i.name).join(", ")
          return {
            nct: id.nctId || "",
            title: id.briefTitle || "",
            status: (stat.overallStatus as string) || "",
            phase: (des.phases as string[]) || [],
            type: (des.studyType as string) || "",
            sponsor: sp.name || "",
            enrollment: ((des.enrollmentInfo as Record<string, unknown>) || {}).count || "—",
            start: ((stat.startDateStruct as Record<string, string>) || {}).date || "",
            end: ((stat.primaryCompletionDateStruct as Record<string, string>) || {}).date || "",
            interventions,
            summary: desc.briefSummary || "",
            conditions: (cond.conditions || []).join(", "),
          }
        })

        setState({ trials, loading: false, error: null, isFallback: false })
      } catch (e) {
        setState({
          trials: [...STATIC_TRIALS],
          loading: false,
          error: (e as Error).message,
          isFallback: true,
        })
      }
    }
    load()
  }, [])

  return state
}

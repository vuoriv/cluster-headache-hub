import type { RawTrial } from "./types.js"

const API_BASE = "https://clinicaltrials.gov/api/v2/studies"

// Fetch all cluster headache trials (not just active — we want historical data too)
const STATUSES = [
  "RECRUITING",
  "NOT_YET_RECRUITING",
  "ACTIVE_NOT_RECRUITING",
  "COMPLETED",
  "TERMINATED",
  "WITHDRAWN",
  "SUSPENDED",
  "ENROLLING_BY_INVITATION",
]

export async function fetchTrials(): Promise<RawTrial[]> {
  const allTrials: RawTrial[] = []
  let nextPageToken: string | undefined

  console.log("Fetching clinical trials from ClinicalTrials.gov...")

  do {
    const params = new URLSearchParams({
      "query.cond": "cluster headache",
      "filter.overallStatus": STATUSES.join(","),
      pageSize: "100",
      format: "json",
    })
    if (nextPageToken) params.set("pageToken", nextPageToken)

    const url = `${API_BASE}?${params}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`ClinicalTrials.gov HTTP ${res.status}`)

    const data = await res.json()
    const studies = data.studies || []

    for (const s of studies) {
      const p = s.protocolSection || {}
      const id = p.identificationModule || {}
      const stat = p.statusModule || {}
      const des = p.designModule || {}
      const sp = (p.sponsorCollaboratorsModule || {}).leadSponsor || {}
      const arms = p.armsInterventionsModule || {}
      const desc = p.descriptionModule || {}
      const cond = p.conditionsModule || {}

      allTrials.push({
        nctId: id.nctId || "",
        title: id.briefTitle || "",
        status: stat.overallStatus || "",
        phase: des.phases || [],
        studyType: des.studyType || "",
        sponsor: sp.name || "",
        enrollment: (des.enrollmentInfo || {}).count ?? null,
        startDate: (stat.startDateStruct || {}).date || "",
        endDate: (stat.primaryCompletionDateStruct || {}).date || "",
        interventions: (arms.interventions || []).map(
          (i: { name: string }) => i.name,
        ),
        summary: desc.briefSummary || "",
        conditions: cond.conditions || [],
        rawJson: JSON.stringify(s),
      })
    }

    nextPageToken = data.nextPageToken
    if (nextPageToken) {
      await new Promise((r) => setTimeout(r, 200))
    }
  } while (nextPageToken)

  console.log(`  Fetched ${allTrials.length} trials`)
  return allTrials
}

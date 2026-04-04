import { useState, useEffect, useCallback } from "react"
import { AnalysisDbProvider } from "@/lib/analysis-db"
import { CbLanding } from "./clusterbusters/cb-landing"
import { CbTreatmentDetail } from "./clusterbusters/cb-treatment-detail"
import { CbCompare } from "./clusterbusters/cb-compare"
import { CbMethodology } from "./clusterbusters/cb-methodology"

function parseSubRoute(): { page: string; param?: string } {
  const hash = window.location.hash.slice(1)
  const parts = hash.split("/")
  if (parts[0] !== "clusterbusters") return { page: "" }
  if (parts.length === 1) return { page: "" }
  if (parts[1] === "compare") return { page: "compare" }
  if (parts[1] === "methodology") return { page: "methodology" }
  // Any other subpath is a treatment slug (e.g., #clusterbusters/psilocybin-mushrooms)
  if (parts[1]) return { page: "treatment", param: parts[1] }
  return { page: "" }
}

export function ClusterBustersTab() {
  const [route, setRoute] = useState(parseSubRoute)

  useEffect(() => {
    const onHashChange = () => setRoute(parseSubRoute())
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  const onNavigate = useCallback((path: string) => {
    const fullHash = path ? `clusterbusters/${path}` : "clusterbusters"
    window.location.hash = fullHash
  }, [])

  const content = (() => {
    switch (route.page) {
      case "treatment":
        if (!route.param) return <CbLanding onNavigate={onNavigate} />
        return <CbTreatmentDetail slug={route.param} onNavigate={onNavigate} />
      case "compare":
        return <CbCompare onNavigate={onNavigate} />
      case "methodology":
        return <CbMethodology onNavigate={onNavigate} />
      default:
        return <CbLanding onNavigate={onNavigate} />
    }
  })()

  return <AnalysisDbProvider>{content}</AnalysisDbProvider>
}

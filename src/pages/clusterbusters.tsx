import { useCallback } from "react"
import { Routes, Route, useNavigate, useParams, Navigate } from "react-router-dom"
import { CbLanding } from "@/components/tabs/clusterbusters/cb-landing"
import { CbTreatmentDetail } from "@/components/tabs/clusterbusters/cb-treatment-detail"
import { CbCompare } from "@/components/tabs/clusterbusters/cb-compare"
import { CbMethodology } from "@/components/tabs/clusterbusters/cb-methodology"
import { InsightsIndex } from "@/pages/insights/index"
import { InsightPage } from "@/pages/insights/insight-page"

export default function ClusterBustersPage() {
  const navigate = useNavigate()

  const onNavigate = useCallback(
    (path: string) => {
      const target = path ? `/clusterbusters/${path}` : "/clusterbusters"
      navigate(target)
    },
    [navigate],
  )

  return (
    <Routes>
      <Route index element={<CbLanding onNavigate={onNavigate} />} />
      <Route path="compare" element={<CbCompare onNavigate={onNavigate} />} />
      <Route path="methodology" element={<CbMethodology onNavigate={onNavigate} />} />
      <Route path="insights" element={<InsightsIndex />} />
      <Route path="insights/:slug" element={<InsightPage />} />
      <Route
        path=":slug"
        element={<TreatmentDetailWrapper onNavigate={onNavigate} />}
      />
      <Route path="*" element={<Navigate to="/clusterbusters" replace />} />
    </Routes>
  )
}

function TreatmentDetailWrapper({
  onNavigate,
}: {
  onNavigate: (path: string) => void
}) {
  const { slug } = useParams<{ slug: string }>()
  if (!slug) return <Navigate to="/clusterbusters" replace />
  return <CbTreatmentDetail slug={slug} onNavigate={onNavigate} />
}

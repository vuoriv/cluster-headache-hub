import { Routes, Route, Navigate } from "react-router-dom"
import { ResearchIndex } from "@/pages/research/index"
import { ResearchSearchPage } from "@/pages/research-search"
import { ActiveTrialsPage } from "@/pages/active-trials"
import { ResearchLandscape } from "@/pages/research/landscape"
import { EvidenceDashboard } from "@/pages/research/evidence"
import { CategoryPage } from "@/pages/research/category"

export default function ResearchPage() {
  return (
    <Routes>
      <Route index element={<ResearchIndex />} />
      <Route path="papers" element={<ResearchSearchPage />} />
      <Route path="trials" element={<ActiveTrialsPage />} />
      <Route path="insights/landscape" element={<ResearchLandscape />} />
      <Route path="insights/evidence" element={<EvidenceDashboard />} />
      <Route path="category/:slug" element={<CategoryPage />} />
      <Route path="*" element={<Navigate to="/research" replace />} />
    </Routes>
  )
}

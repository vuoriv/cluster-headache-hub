import { lazy, Suspense, useEffect } from "react"
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DataDbProvider } from "@/lib/data-db"
import { Layout } from "@/components/layout/layout"
import { FrontPage } from "@/pages/front-page"
import { ResearchIndex } from "@/pages/research/index"
import { ResearchSearchPage } from "@/pages/research-search"
import { ActiveTrialsPage } from "@/pages/active-trials"
import { ResearchLandscape } from "@/pages/research/landscape"
import { EvidenceDashboard } from "@/pages/research/evidence"

const ClusterBustersPage = lazy(() => import("@/pages/clusterbusters"))

function ClusterBustersFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading ClusterBusters...</p>
      </div>
    </div>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter basename="/cluster-headache-hub">
      <ScrollToTop />
      <TooltipProvider>
        <DataDbProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<FrontPage />} />
              <Route
                path="/clusterbusters/*"
                element={
                  <Suspense fallback={<ClusterBustersFallback />}>
                    <ClusterBustersPage />
                  </Suspense>
                }
              />
              <Route path="/research" element={<ResearchIndex />} />
              <Route path="/research/papers" element={<ResearchSearchPage />} />
              <Route path="/research/trials" element={<ActiveTrialsPage />} />
              <Route path="/research/insights/landscape" element={<ResearchLandscape />} />
              <Route path="/research/insights/evidence" element={<EvidenceDashboard />} />
            </Route>
          </Routes>
        </DataDbProvider>
      </TooltipProvider>
    </BrowserRouter>
  )
}

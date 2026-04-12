import { lazy, Suspense, useEffect } from "react"
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DataDbProvider } from "@/lib/data-db"
import { ErrorBoundary } from "@/components/error-boundary"
import { Layout } from "@/components/layout/layout"
import { FrontPage } from "@/pages/front-page"
import { CommunityPage } from "@/pages/community"

const ClusterBustersPage = lazy(() => import("@/pages/clusterbusters"))
const ResearchPage = lazy(() => import("@/pages/research-page"))

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading...</p>
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
        <ErrorBoundary>
          <DataDbProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<FrontPage />} />
                <Route
                  path="/clusterbusters/*"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <ClusterBustersPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/research/*"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <ResearchPage />
                    </Suspense>
                  }
                />
                <Route path="/community" element={<CommunityPage />} />
              </Route>
            </Routes>
          </DataDbProvider>
        </ErrorBoundary>
      </TooltipProvider>
    </BrowserRouter>
  )
}

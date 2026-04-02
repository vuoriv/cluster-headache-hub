import { useMemo, useState, useEffect, useCallback } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Header } from "@/components/layout/header"
import { OverviewTab } from "@/components/tabs/overview-tab"
import { TrialsTab } from "@/components/tabs/trials-tab"
import { ResearchTab } from "@/components/tabs/research-tab"
import { TreatmentsTab } from "@/components/tabs/treatments-tab"
import { CommunityTab } from "@/components/tabs/community-tab"
import { TriggersTab } from "@/components/tabs/triggers-tab"
import { useTrials } from "@/hooks/use-trials"
import { usePapers } from "@/hooks/use-papers"
import { categoryForTrial } from "@/lib/types"

export default function App() {
  const { trials, loading: trialsLoading, error: trialsError, isFallback } = useTrials()
  const { papers, totalCount, loading: papersLoading, error: papersError, progress } = usePapers()

  const trialStats = useMemo(() => {
    if (trialsLoading) return { total: null, recruiting: null, psychedelic: null }
    const recruiting = trials.filter((t) => t.status === "RECRUITING").length
    const psychedelic = trials.filter((t) => categoryForTrial(t) === "psychedelic").length
    return { total: trials.length, recruiting, psychedelic }
  }, [trials, trialsLoading])

  const paperCount = papersLoading ? null : totalCount

  const validTabs = ["overview", "trials", "research", "treatments", "community", "triggers"]
  const getTabFromHash = useCallback(() => {
    const hash = window.location.hash.slice(1)
    return validTabs.includes(hash) ? hash : "overview"
  }, [])

  const [activeTab, setActiveTab] = useState(getTabFromHash)

  useEffect(() => {
    const onHashChange = () => setActiveTab(getTabFromHash())
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [getTabFromHash])

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value)
    window.history.replaceState(null, "", `#${value}`)
  }, [])

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <Header
          trialCount={trialStats.total}
          recruitingCount={trialStats.recruiting}
          paperCount={paperCount}
          psychedelicCount={trialStats.psychedelic}
          loading={trialsLoading || papersLoading}
        />

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="mb-8 w-full justify-start">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="trials">
                Trials
                {trialStats.total !== null && (
                  <Badge variant="secondary" className="ml-1.5 text-[0.7rem]">{trialStats.total}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="research">
                Research
                {!papersLoading && papers.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[0.7rem]">{papers.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="treatments">Treatments</TabsTrigger>
              <TabsTrigger value="community">Community</TabsTrigger>
              <TabsTrigger value="triggers">Triggers</TabsTrigger>
            </TabsList>

            <TabsContent value="overview"><OverviewTab /></TabsContent>
            <TabsContent value="trials"><TrialsTab trials={trials} loading={trialsLoading} error={trialsError} isFallback={isFallback} /></TabsContent>
            <TabsContent value="research"><ResearchTab papers={papers} totalCount={totalCount} loading={papersLoading} error={papersError} progress={progress} /></TabsContent>
            <TabsContent value="treatments"><TreatmentsTab /></TabsContent>
            <TabsContent value="community"><CommunityTab /></TabsContent>
            <TabsContent value="triggers"><TriggersTab /></TabsContent>
          </Tabs>
        </main>

        <footer className="border-t bg-muted/50 px-6 py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:justify-between">
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <p>
                Data from{" "}
                <a href="https://clinicaltrials.gov" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground/70 hover:underline">ClinicalTrials.gov</a>
                {" "}and{" "}
                <a href="https://pubmed.ncbi.nlm.nih.gov" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground/70 hover:underline">PubMed</a>
                {" "}via public APIs.
              </p>
              <p>Community info from Clusterbusters, r/ClusterHeadaches, and patient survey literature.</p>
            </div>
            <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
              <p className="font-medium">Not medical advice.</p>
              <p>Built 2026</p>
            </div>
          </div>
          <Separator className="my-4" />
          <p className="text-center text-[0.7rem] text-muted-foreground/50">
            Press <kbd className="rounded border px-1 py-0.5 font-mono text-[0.65rem]">d</kbd> to toggle dark mode
          </p>
        </footer>
      </div>
    </TooltipProvider>
  )
}

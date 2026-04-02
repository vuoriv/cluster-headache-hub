import { useMemo } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
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

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-6 flex w-full flex-wrap justify-start gap-1 bg-transparent p-0">
              <TabsTrigger value="overview">
                Overview
              </TabsTrigger>
              <TabsTrigger value="trials">
                Trials
                {trialStats.total !== null && (
                  <Badge variant="secondary" className="ml-1.5 text-[0.65rem]">{trialStats.total}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="research">
                Research
                {!papersLoading && papers.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[0.65rem]">{papers.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="treatments">
                Treatments
              </TabsTrigger>
              <TabsTrigger value="community">
                Community
              </TabsTrigger>
              <TabsTrigger value="triggers">
                Triggers
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview"><OverviewTab /></TabsContent>
            <TabsContent value="trials"><TrialsTab trials={trials} loading={trialsLoading} error={trialsError} isFallback={isFallback} /></TabsContent>
            <TabsContent value="research"><ResearchTab papers={papers} totalCount={totalCount} loading={papersLoading} error={papersError} progress={progress} /></TabsContent>
            <TabsContent value="treatments"><TreatmentsTab /></TabsContent>
            <TabsContent value="community"><CommunityTab /></TabsContent>
            <TabsContent value="triggers"><TriggersTab /></TabsContent>
          </Tabs>
        </main>

        <footer className="mt-12 bg-primary px-6 py-5 text-center text-xs text-primary-foreground/60">
          <p>
            Data sourced from{" "}
            <a href="https://clinicaltrials.gov" target="_blank" rel="noopener noreferrer" className="text-primary-foreground/80 hover:underline">ClinicalTrials.gov</a>
            {" "}and{" "}
            <a href="https://pubmed.ncbi.nlm.nih.gov" target="_blank" rel="noopener noreferrer" className="text-primary-foreground/80 hover:underline">PubMed / NCBI</a>
            {" "}via public APIs — refreshed on every page load.
          </p>
          <p className="mt-1">Community treatment information sourced from Clusterbusters, r/ClusterHeadaches, and patient survey literature. Not medical advice.</p>
          <p className="mt-1 opacity-50">Built 2026 — Cluster Headache Research Hub</p>
        </footer>
      </div>
    </TooltipProvider>
  )
}

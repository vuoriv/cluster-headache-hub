import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Zap, Microscope, Pill, Globe } from "lucide-react"

const RESOURCES = [
  { href: "https://clusterbusters.org", label: "Clusterbusters.org" },
  { href: "https://www.reddit.com/r/clusterheadaches", label: "r/ClusterHeadaches" },
  { href: "https://ouchuk.org", label: "OUCH UK" },
  { href: "https://clusterfree.org", label: "ClusterFree.org" },
  { href: "https://vitamindregimen.com", label: "Vitamin D3 Regimen" },
  { href: "https://clusterheadachewarriors.org", label: "CH Warriors" },
  { href: "https://migrainedisorders.org/cluster-headache-guide", label: "AMD CH Guide" },
]

function SectionIcon({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">{children}</span>
}

export function OverviewTab() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t("overview.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("overview.subtitle")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-accent/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SectionIcon><Zap className="size-4" /></SectionIcon>
              {t("overview.basics.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li><strong className="text-foreground">{t("common.pain")}:</strong> {t("overview.basics.pain")}</li>
              <li><strong className="text-foreground">{t("common.autonomicFeatures")}:</strong> {t("overview.basics.autonomic")}</li>
              <li><strong className="text-foreground">{t("common.pattern")}:</strong> {t("overview.basics.pattern")}</li>
              <li><strong className="text-foreground">{t("common.types")}:</strong> {t("overview.basics.types")}</li>
              <li><strong className="text-foreground">{t("common.prevalence")}:</strong> {t("overview.basics.prevalence")}</li>
              <li><strong className="text-foreground">{t("common.keyPathways")}:</strong> {t("overview.basics.pathways")}</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SectionIcon><Microscope className="size-4" /></SectionIcon>
              {t("overview.research.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Psychedelics:</strong> {t("overview.research.psychedelics")}</li>
              <li><strong className="text-foreground">CGRP:</strong> {t("overview.research.cgrp")}</li>
              <li><strong className="text-foreground">Sleep:</strong> {t("overview.research.sleep")}</li>
              <li><strong className="text-foreground">Neuromodulation:</strong> {t("overview.research.neuromod")}</li>
              <li><strong className="text-foreground">Genetics:</strong> {t("overview.research.genetics")}</li>
              <li><strong className="text-foreground">Biomarkers:</strong> {t("overview.research.biomarkers")}</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SectionIcon><Pill className="size-4" /></SectionIcon>
              {t("overview.approved.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li><strong className="text-foreground">{t("common.acute")}:</strong> {t("overview.approved.acute")}</li>
              <li><strong className="text-foreground">{t("common.preventive")}:</strong> {t("overview.approved.preventive")}</li>
              <li><strong className="text-foreground">{t("common.transitional")}:</strong> {t("overview.approved.transitional")}</li>
              <li><strong className="text-foreground">{t("common.device")}:</strong> {t("overview.approved.device")}</li>
            </ul>
          </CardContent>
        </Card>

        <Alert variant="warning">
          <AlertTriangle className="size-4" />
          <AlertTitle>{t("overview.disclaimer.title")}</AlertTitle>
          <AlertDescription className="text-sm" dangerouslySetInnerHTML={{ __html: t("overview.disclaimer.text") }} />
        </Alert>
      </div>

      <Card className="border-l-4 border-l-destructive bg-destructive/3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SectionIcon><AlertTriangle className="size-4" /></SectionIcon>
            {t("overview.gap.title")}
          </CardTitle>
          <CardDescription>{t("overview.gap.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
            <li><strong className="text-foreground">{t("common.averageDiagnosticDelay")}</strong> {t("overview.gap.delay")}</li>
            <li><strong className="text-foreground">{t("common.oxygenIsNumber1")}</strong> {t("overview.gap.oxygen")}</li>
            <li><strong className="text-foreground">{t("common.commonPrescribingFailures")}</strong> {t("overview.gap.failures")}</li>
            <li><strong className="text-foreground">{t("common.medicationsMakeWorse")}</strong> {t("overview.gap.worse")}</li>
            <li><strong className="text-foreground">{t("common.communityKnowledgeSavesLives")}</strong> {t("overview.gap.community")}</li>
          </ul>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SectionIcon><Globe className="size-4" /></SectionIcon>
            {t("overview.resources")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {RESOURCES.map((r) => (
              <a key={r.href} href={r.href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                {r.label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

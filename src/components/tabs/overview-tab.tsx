import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Zap, Microscope, Globe, Users, MessageCircle, Heart, Sun, BookOpen, Shield, ExternalLink } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface Resource {
  href: string
  label: string
  desc: string
  icon: LucideIcon
  badge?: string
  badgeVariant?: "success" | "info" | "purple" | "secondary"
}

const RESOURCES: Resource[] = [
  { href: "https://clusterbusters.org", label: "Clusterbusters", desc: "The largest CH patient org. Busting protocols, doctor letter templates, forums.", icon: Users, badge: "Essential", badgeVariant: "success" },
  { href: "https://www.reddit.com/r/clusterheadaches", label: "r/ClusterHeadaches", desc: "Active patient community. Real-time advice, support, and shared experience.", icon: MessageCircle, badge: "Community", badgeVariant: "info" },
  { href: "https://vitamindregimen.com", label: "Vitamin D3 Regimen", desc: "Full Batch Protocol details. 80% responder rate. Start early in your cycle.", icon: Sun, badge: "Treatment", badgeVariant: "purple" },
  { href: "https://ouchuk.org", label: "OUCH UK", desc: "UK patient charity. Support groups, helpline, medical professional resources.", icon: Heart },
  { href: "https://clusterfree.org", label: "ClusterFree.org", desc: "Research advocacy. Funds clinical trials for new CH treatments.", icon: Shield },
  { href: "https://clusterheadachewarriors.org", label: "CH Warriors", desc: "US-based advocacy and support. Patient stories and awareness campaigns.", icon: Users },
  { href: "https://migrainedisorders.org/cluster-headache-guide", label: "AMD CH Guide", desc: "Printable guide for your doctor if they're unfamiliar with cluster headache.", icon: BookOpen, badge: "For doctors", badgeVariant: "secondary" },
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

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Globe className="size-4 text-primary" />
          {t("overview.resources")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCES.map((r) => {
            const Icon = r.icon
            return (
              <a
                key={r.href}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
                  <CardContent className="flex gap-3 py-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary transition-colors group-hover:bg-primary/15">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold group-hover:text-primary">{r.label}</span>
                        <ExternalLink className="size-3 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                        {r.badge && r.badgeVariant && (
                          <Badge variant={r.badgeVariant} className="text-[0.6rem]">{r.badge}</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{r.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}

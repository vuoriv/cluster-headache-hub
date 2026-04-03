import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Zap, Shield, FlaskConical, Ban, Star } from "lucide-react"

type BadgeVariant = "success" | "info" | "warning" | "purple" | "cyan" | "amber" | "danger" | "secondary" | "outline"
type AccentColor = "primary" | "destructive"

interface TreatmentCardProps {
  cardKey: string
  badgeText: string
  badgeVariant?: BadgeVariant
  accent?: AccentColor
}

// Effectiveness data from Schindler et al. 2015 patient survey
// complete = "complete effectiveness", moderate = "moderate effectiveness", n = sample size
// null = no survey data available (abortive treatments, not preventives)
const COMP_ITEMS = [
  { key: "o2", doctorVariant: "purple" as const, efficacy: null },
  { key: "d3", doctorVariant: "warning" as const, efficacy: null },
  { key: "sumatriptan", doctorVariant: "success" as const, efficacy: null },
  { key: "energy", doctorVariant: "warning" as const, efficacy: null },
  { key: "melatonin", doctorVariant: "warning" as const, efficacy: { complete: 10, moderate: 20, n: 258 } },
  { key: "gon", doctorVariant: "success" as const, efficacy: null },
  { key: "busting", doctorVariant: "purple" as const, efficacy: { complete: 40, moderate: 32, n: 363 } },
]

// Conventional preventives for comparison bar
const CONVENTIONAL_EFFICACY = [
  { name: "Psilocybin", complete: 41, moderate: 30, n: 181 },
  { name: "LSD", complete: 39, moderate: 39, n: 74 },
  { name: "LSA", complete: 19, moderate: 40, n: 108 },
  { name: "Prednisone", complete: 19, moderate: 27, n: 312 },
  { name: "Lithium", complete: 20, moderate: 17, n: 148 },
  { name: "Melatonin", complete: 10, moderate: 20, n: 258 },
  { name: "Verapamil", complete: 7, moderate: 29, n: 364 },
  { name: "Topiramate", complete: 3, moderate: 12, n: 224 },
  { name: "Propranolol", complete: 2, moderate: 3, n: 132 },
]

function TreatmentCard({ cardKey, badgeText, badgeVariant = "secondary", accent = "primary" }: TreatmentCardProps) {
  const { t } = useTranslation()
  const items = t(`treatments.cards.${cardKey}.items`, { returnObjects: true }) as string[]
  const note = t(`treatments.cards.${cardKey}.note`, { defaultValue: "" })

  return (
    <Card className={cn("border-l-4", accent === "destructive" ? "border-l-destructive" : "border-l-ring")}>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          {t(`treatments.cards.${cardKey}.title`)}
          <Badge variant={badgeVariant} className="text-[0.68rem]">{badgeText}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
        {note && <p className="mt-2 text-xs text-muted-foreground italic">{note}</p>}
      </CardContent>
    </Card>
  )
}

export function TreatmentsTab() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{t("treatments.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("treatments.subtitle")}</p>
        </div>
        <Badge variant="outline" className="mt-1 text-xs">{t("treatments.badge")}</Badge>
      </div>

      <Alert variant="warning">
        <AlertTriangle className="size-4" />
        <AlertDescription>
          <strong>{t("treatments.newPatientWarningLabel")}</strong> {t("treatments.newPatientWarning")}
        </AlertDescription>
      </Alert>

      {/* Community vs Standard Care — as cards, not table */}
      <Card className="border-2 border-ring">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="size-4 text-primary" />
            {t("treatments.comparisonTitle")}
          </CardTitle>
          <CardDescription>{t("treatments.comparisonDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {COMP_ITEMS.map((item) => (
              <div key={item.key} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{t(`treatments.comp.${item.key}.name`)}</span>
                    <Badge variant={item.doctorVariant} className="text-[0.6rem]">
                      {t(`treatments.comp.${item.key}.doctor`)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {t(`treatments.comp.${item.key}.community`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Effectiveness chart — Schindler 2015 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Treatment Effectiveness — Patient Survey</CardTitle>
          <CardDescription>
            Schindler et al. 2015 — preventive treatments rated by {CONVENTIONAL_EFFICACY.reduce((s, e) => s + e.n, 0).toLocaleString()} patients. Shows % reporting complete or moderate effectiveness.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2.5">
            {CONVENTIONAL_EFFICACY.map((item) => {
              const total = item.complete + item.moderate
              const isPhychedelic = ["Psilocybin", "LSD", "LSA"].includes(item.name)
              return (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-right text-xs font-medium">{item.name}</span>
                  <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full transition-all",
                        isPhychedelic ? "bg-[oklch(0.55_0.15_300)]" : "bg-ring/60"
                      )}
                      style={{ width: `${total}%` }}
                    />
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full transition-all",
                        isPhychedelic ? "bg-[oklch(0.45_0.2_300)]" : "bg-ring"
                      )}
                      style={{ width: `${item.complete}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {total}% <span className="text-[0.6rem]">n={item.n}</span>
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.65rem] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-[oklch(0.45_0.2_300)]" /> Complete (psychedelic)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-[oklch(0.55_0.15_300)]" /> Moderate (psychedelic)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-ring" /> Complete (conventional)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-ring/60" /> Moderate (conventional)</span>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Zap className="size-4 text-primary" />{t("treatments.acute")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TreatmentCard cardKey="o2" badgeText="First-line ✓" badgeVariant="success" />
          <TreatmentCard cardKey="sumatriptan" badgeText="First-line ✓" badgeVariant="info" />
          <TreatmentCard cardKey="gammacore" badgeText="FDA-cleared" badgeVariant="amber" />
          <TreatmentCard cardKey="civamide" badgeText="Phase 3 completed" badgeVariant="purple" />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Shield className="size-4 text-primary" />{t("treatments.preventive")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TreatmentCard cardKey="verapamil" badgeText="First-line ✓" badgeVariant="success" />
          <TreatmentCard cardKey="galcanezumab" badgeText="FDA-approved ✓" badgeVariant="success" />
          <TreatmentCard cardKey="lithium" badgeText="Second-line" badgeVariant="amber" accent="destructive" />
          <TreatmentCard cardKey="melatonin" badgeText="Adjunct option" badgeVariant="amber" />
          <TreatmentCard cardKey="gonBlock" badgeText="Transitional ✓" badgeVariant="info" />
          <TreatmentCard cardKey="spg" badgeText="Refractory CH" badgeVariant="purple" />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><FlaskConical className="size-4 text-primary" />{t("treatments.inTrials")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TreatmentCard cardKey="psilocybin" badgeText="Phase 2" badgeVariant="purple" />
          <TreatmentCard cardKey="lsd" badgeText="Phase 2" badgeVariant="purple" />
          <TreatmentCard cardKey="ketamine" badgeText="Phase 4 (KETALGIA)" badgeVariant="info" />
          <TreatmentCard cardKey="oxybate" badgeText="Phase 2" badgeVariant="info" />
          <TreatmentCard cardKey="light" badgeText="Proof of concept" badgeVariant="amber" />
          <TreatmentCard cardKey="botox" badgeText="Phase 3" badgeVariant="amber" />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Ban className="size-4 text-destructive" />{t("treatments.prescribingFailures")}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t("treatments.prescribingFailuresDesc")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TreatmentCard cardKey="oralTriptans" badgeText="Ineffective" badgeVariant="danger" accent="destructive" />
          <TreatmentCard cardKey="opioids" badgeText="Don't work" badgeVariant="danger" accent="destructive" />
          <TreatmentCard cardKey="migrainePreventives" badgeText="Wrong condition" badgeVariant="danger" accent="destructive" />
          <TreatmentCard cardKey="ssris" badgeText="Caution" badgeVariant="danger" accent="destructive" />
        </div>
      </div>
    </div>
  )
}

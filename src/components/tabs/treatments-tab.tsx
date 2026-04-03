import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Zap, Shield, FlaskConical, Ban, BarChart3 } from "lucide-react"

type BadgeVariant = "success" | "info" | "warning" | "purple" | "cyan" | "amber" | "danger" | "secondary" | "outline"
type AccentColor = "primary" | "destructive"

interface TreatmentCardProps {
  cardKey: string
  badgeText: string
  badgeVariant?: BadgeVariant
  accent?: AccentColor
  labels?: { text: string; variant: BadgeVariant }[]
}

// Schindler et al. 2015 patient survey effectiveness data
const EFFICACY_DATA = [
  { name: "Psilocybin", complete: 41, moderate: 30, n: 181, psychedelic: true },
  { name: "LSD", complete: 39, moderate: 39, n: 74, psychedelic: true },
  { name: "LSA", complete: 19, moderate: 40, n: 108, psychedelic: true },
  { name: "BOL-148", complete: 50, moderate: 40, n: 10, psychedelic: true },
  { name: "Prednisone", complete: 19, moderate: 27, n: 312, psychedelic: false },
  { name: "Lithium", complete: 20, moderate: 17, n: 148, psychedelic: false },
  { name: "Melatonin", complete: 10, moderate: 20, n: 258, psychedelic: false },
  { name: "Verapamil", complete: 7, moderate: 29, n: 364, psychedelic: false },
  { name: "Topiramate", complete: 3, moderate: 12, n: 224, psychedelic: false },
  { name: "Gabapentin", complete: 2, moderate: 10, n: 127, psychedelic: false },
  { name: "Amitriptyline", complete: 3, moderate: 10, n: 151, psychedelic: false },
  { name: "Propranolol", complete: 2, moderate: 3, n: 132, psychedelic: false },
]

function TreatmentCard({ cardKey, badgeText, badgeVariant = "secondary", accent = "primary", labels = [] }: TreatmentCardProps) {
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
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {labels.map((l) => (
              <Badge key={l.text} variant={l.variant} className="text-[0.58rem] font-normal">{l.text}</Badge>
            ))}
          </div>
        )}
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

// Label constants
const RX = { text: "℞ Prescription", variant: "outline" as const }
const SELF = { text: "Self-care", variant: "purple" as const }
const CB = { text: "Clusterbusters ✓", variant: "success" as const }
const OTC = { text: "OTC", variant: "info" as const }
const SPECIALIST = { text: "Specialist", variant: "warning" as const }

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

      {/* Effectiveness chart — Schindler 2015 */}
      <Card className="border-2 border-ring">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4 text-primary" />
            Treatment Effectiveness — Patient Survey
          </CardTitle>
          <CardDescription>
            Schindler et al. 2015 — preventive treatments rated by {EFFICACY_DATA.reduce((s, e) => s + e.n, 0).toLocaleString()} patients. % reporting complete or moderate effectiveness.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {EFFICACY_DATA.map((item) => {
              const total = item.complete + item.moderate
              return (
                <div key={item.name} className="flex items-center gap-3">
                  <span className={cn("w-24 shrink-0 text-right text-xs font-medium", item.psychedelic && "text-[oklch(0.55_0.15_300)] dark:text-[oklch(0.75_0.12_300)]")}>{item.name}</span>
                  <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full",
                        item.psychedelic ? "bg-[oklch(0.65_0.12_300)]" : "bg-ring/50"
                      )}
                      style={{ width: `${total}%` }}
                    />
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full",
                        item.psychedelic ? "bg-[oklch(0.50_0.18_300)]" : "bg-ring"
                      )}
                      style={{ width: `${item.complete}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {total}% <span className="text-[0.6rem] opacity-60">n={item.n}</span>
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.65rem] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-[oklch(0.50_0.18_300)]" /> Complete (psychedelic)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-[oklch(0.65_0.12_300)]" /> + Moderate</span>
            <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-ring" /> Complete (conventional)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-ring/50" /> + Moderate</span>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Zap className="size-4 text-primary" />{t("treatments.acute")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TreatmentCard cardKey="o2" badgeText="First-line ✓" badgeVariant="success" labels={[SELF, CB]} />
          <TreatmentCard cardKey="sumatriptan" badgeText="First-line ✓" badgeVariant="info" labels={[RX, CB]} />
          <TreatmentCard cardKey="gammacore" badgeText="FDA-cleared" badgeVariant="amber" labels={[{ text: "Device", variant: "outline" }, CB]} />
          <TreatmentCard cardKey="civamide" badgeText="Phase 3 completed" badgeVariant="purple" labels={[RX]} />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Shield className="size-4 text-primary" />{t("treatments.preventive")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TreatmentCard cardKey="verapamil" badgeText="First-line ✓" badgeVariant="success" labels={[RX, SPECIALIST]} />
          <TreatmentCard cardKey="galcanezumab" badgeText="FDA-approved ✓" badgeVariant="success" labels={[RX, SPECIALIST]} />
          <TreatmentCard cardKey="lithium" badgeText="Second-line" badgeVariant="amber" accent="destructive" labels={[RX, SPECIALIST]} />
          <TreatmentCard cardKey="melatonin" badgeText="Adjunct" badgeVariant="amber" labels={[OTC, SELF, CB]} />
          <TreatmentCard cardKey="gonBlock" badgeText="Transitional ✓" badgeVariant="info" labels={[RX, SPECIALIST]} />
          <TreatmentCard cardKey="spg" badgeText="Refractory CH" badgeVariant="purple" labels={[RX, SPECIALIST]} />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><FlaskConical className="size-4 text-primary" />{t("treatments.inTrials")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TreatmentCard cardKey="psilocybin" badgeText="Phase 2" badgeVariant="purple" labels={[SELF, CB]} />
          <TreatmentCard cardKey="lsd" badgeText="Phase 2" badgeVariant="purple" labels={[SELF, CB]} />
          <TreatmentCard cardKey="ketamine" badgeText="Phase 4 (KETALGIA)" badgeVariant="info" labels={[RX, SPECIALIST]} />
          <TreatmentCard cardKey="oxybate" badgeText="Phase 2" badgeVariant="info" labels={[RX]} />
          <TreatmentCard cardKey="light" badgeText="Proof of concept" badgeVariant="amber" labels={[{ text: "Device", variant: "outline" }]} />
          <TreatmentCard cardKey="botox" badgeText="Phase 3" badgeVariant="amber" labels={[RX, SPECIALIST]} />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Ban className="size-4 text-destructive" />{t("treatments.prescribingFailures")}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t("treatments.prescribingFailuresDesc")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TreatmentCard cardKey="oralTriptans" badgeText="Ineffective" badgeVariant="danger" accent="destructive" labels={[RX]} />
          <TreatmentCard cardKey="opioids" badgeText="Don't work" badgeVariant="danger" accent="destructive" labels={[RX]} />
          <TreatmentCard cardKey="migrainePreventives" badgeText="Wrong condition" badgeVariant="danger" accent="destructive" labels={[RX]} />
          <TreatmentCard cardKey="ssris" badgeText="Caution" badgeVariant="danger" accent="destructive" labels={[RX]} />
        </div>
      </div>
    </div>
  )
}

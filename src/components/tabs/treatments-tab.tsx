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

const COMP_ITEMS = [
  { key: "o2", rank: 1, doctorVariant: "danger" as const },
  { key: "d3", rank: 2, doctorVariant: "warning" as const },
  { key: "sumatriptan", rank: 3, doctorVariant: "success" as const },
  { key: "energy", rank: 4, doctorVariant: "warning" as const },
  { key: "melatonin", rank: 5, doctorVariant: "warning" as const },
  { key: "verapamil", rank: 6, doctorVariant: "info" as const },
  { key: "gon", rank: 7, doctorVariant: "success" as const },
  { key: "busting", rank: 8, doctorVariant: "purple" as const },
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
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {item.rank}
                </div>
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

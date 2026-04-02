import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, Wine, Mountain, Wind, Moon, Pill, Utensils, Thermometer, Sun, CloudRain, Heart } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface TriggerDef {
  key: string
  severity: "high" | "medium" | "low"
  sevVariant: "danger" | "amber" | "info"
  icon: LucideIcon
  borderClass: string
  iconBg: string
}

const TRIGGERS: TriggerDef[] = [
  { key: "alcohol", severity: "high", sevVariant: "danger", icon: Wine, borderClass: "border-l-4 border-l-destructive", iconBg: "bg-destructive/10 text-destructive" },
  { key: "altitude", severity: "high", sevVariant: "danger", icon: Mountain, borderClass: "border-l-4 border-l-destructive", iconBg: "bg-destructive/10 text-destructive" },
  { key: "smells", severity: "high", sevVariant: "danger", icon: Wind, borderClass: "border-l-4 border-l-destructive", iconBg: "bg-destructive/10 text-destructive" },
  { key: "sleep", severity: "high", sevVariant: "danger", icon: Moon, borderClass: "border-l-4 border-l-destructive", iconBg: "bg-destructive/10 text-destructive" },
  { key: "vasodilating", severity: "high", sevVariant: "danger", icon: Pill, borderClass: "border-l-4 border-l-destructive", iconBg: "bg-destructive/10 text-destructive" },
  { key: "histamine", severity: "medium", sevVariant: "amber", icon: Utensils, borderClass: "border-l-4 border-l-ring", iconBg: "bg-ring/10 text-ring" },
  { key: "heat", severity: "medium", sevVariant: "amber", icon: Thermometer, borderClass: "border-l-4 border-l-ring", iconBg: "bg-ring/10 text-ring" },
  { key: "light", severity: "low", sevVariant: "info", icon: Sun, borderClass: "border-l-2 border-l-border", iconBg: "bg-muted text-muted-foreground" },
  { key: "season", severity: "low", sevVariant: "info", icon: CloudRain, borderClass: "border-l-2 border-l-border", iconBg: "bg-muted text-muted-foreground" },
  { key: "stress", severity: "low", sevVariant: "info", icon: Heart, borderClass: "border-l-2 border-l-border", iconBg: "bg-muted text-muted-foreground" },
]

function TriggerCard({ trigger }: { trigger: TriggerDef }) {
  const { t } = useTranslation()
  const Icon = trigger.icon
  return (
    <Card className={trigger.borderClass}>
      <CardContent className="flex gap-3 py-4">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${trigger.iconBg}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t(`triggers.items.${trigger.key}.name`)}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t(`triggers.items.${trigger.key}.notes`)}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function TriggersTab() {
  const { t } = useTranslation()

  const highTriggers = TRIGGERS.filter((tr) => tr.severity === "high")
  const mediumTriggers = TRIGGERS.filter((tr) => tr.severity === "medium")
  const lowTriggers = TRIGGERS.filter((tr) => tr.severity === "low")
  const activeCycleItems = t("triggers.activeCycleItems", { returnObjects: true }) as string[]

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold">{t("triggers.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("triggers.subtitle")}</p>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="danger">{t("triggers.highRisk")}</Badge>
          <span className="text-xs text-muted-foreground">{t("triggers.highRiskDesc")}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {highTriggers.map((trigger) => <TriggerCard key={trigger.key} trigger={trigger} />)}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="amber">{t("triggers.mediumRisk")}</Badge>
          <span className="text-xs text-muted-foreground">{t("triggers.mediumRiskDesc")}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {mediumTriggers.map((trigger) => <TriggerCard key={trigger.key} trigger={trigger} />)}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="info">{t("triggers.lowRisk")}</Badge>
          <span className="text-xs text-muted-foreground">{t("triggers.lowRiskDesc")}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {lowTriggers.map((trigger) => <TriggerCard key={trigger.key} trigger={trigger} />)}
        </div>
      </div>

      <Separator />

      <Card className="border-l-4 border-l-ring">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <CheckCircle className="size-4 text-primary" />
            {t("triggers.activeCycle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
            <ul className="flex flex-col gap-1.5">
              {activeCycleItems.slice(0, 4).map((item) => <li key={item.slice(0, 30)}>• {item}</li>)}
            </ul>
            <ul className="flex flex-col gap-1.5">
              {activeCycleItems.slice(4).map((item) => <li key={item.slice(0, 30)}>• {item}</li>)}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

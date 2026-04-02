import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, Wine, Mountain, Wind, Moon, Pill, Utensils, Thermometer, Sun, CloudRain, Heart } from "lucide-react"

const TRIGGERS = [
  { name: "Alcohol (any type)", notes: "Even a small amount reliably triggers attacks during an active bout. The community universally avoids all alcohol during cycles.", severity: "High", sevVariant: "danger" as const, icon: Wine },
  { name: "Altitude / Low oxygen", notes: "Flights, mountains, high altitude environments. Some patients pre-treat with supplemental O₂ before flying.", severity: "High", sevVariant: "danger" as const, icon: Mountain },
  { name: "Strong chemical smells", notes: "Gasoline, paint fumes, perfume, cleaning products, solvents. Wear a mask if exposure is unavoidable.", severity: "High", sevVariant: "danger" as const, icon: Wind },
  { name: "Sleep disruption", notes: "CH attacks frequently occur during or around REM sleep transitions. Jet lag, shift work, naps, or any disruption to sleep schedule.", severity: "High", sevVariant: "danger" as const, icon: Moon },
  { name: "Vasodilating drugs", notes: "Nitrates (GTN sprays), sildenafil/tadalafil, some blood pressure medications. Always inform prescribers about CH.", severity: "High", sevVariant: "danger" as const, icon: Pill },
  { name: "Histamine-rich foods", notes: "Aged cheeses, cured meats, fermented foods. Red wine is a double trigger — both histamine and alcohol/vasodilation.", severity: "Medium", sevVariant: "amber" as const, icon: Utensils },
  { name: "Heat exposure", notes: "Hot baths, saunas, intense exercise in heat. Individual variation — some find hot showers offer temporary relief during an attack.", severity: "Medium", sevVariant: "amber" as const, icon: Thermometer },
  { name: "Bright / flickering light", notes: "Less consistent than migraine triggers but reported by a subset of patients, especially during attacks.", severity: "Low", sevVariant: "info" as const, icon: Sun },
  { name: "Season changes", notes: "Many episodic CH patients have predictable seasonal patterns (spring, autumn). Useful to anticipate and start preventives early.", severity: "Predictive", sevVariant: "info" as const, icon: CloudRain },
  { name: "Stress let-down", notes: "Attacks often occur after stress resolves — weekends, vacations, holidays. Classic pattern in episodic patients.", severity: "Variable", sevVariant: "info" as const, icon: Heart },
]

export function TriggersTab() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold">{t("triggers.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("triggers.subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TRIGGERS.map((trigger) => {
          const Icon = trigger.icon
          return (
            <Card key={trigger.name} className="group transition-all hover:shadow-md">
              <CardContent className="flex gap-4 py-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{trigger.name}</span>
                    <Badge variant={trigger.sevVariant} className="text-[0.6rem]">{trigger.severity}</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{trigger.notes}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
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
              <li>• Zero alcohol — even one drink can trigger an attack within 30–60 minutes</li>
              <li>• Maintain strict sleep schedule; protect sleep timing</li>
              <li>• Carry O₂ or sumatriptan injection at all times</li>
              <li>• Inform airline staff / travel with O₂ documentation</li>
            </ul>
            <ul className="flex flex-col gap-1.5">
              <li>• Avoid scented products and chemical environments</li>
              <li>• Pre-treat with O₂ before known trigger exposure where possible</li>
              <li>• Keep a headache diary to identify personal triggers</li>
              <li>• Alert family/colleagues — attacks are very visible and frightening</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

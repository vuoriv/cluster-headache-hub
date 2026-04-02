import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Trophy, Leaf, Sun } from "lucide-react"

export function CommunityTab() {
  const { t } = useTranslation()

  const priorities = ["1", "2", "3", "4", "5", "6", "7", "8"] as const

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{t("community.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("community.subtitle")}</p>
        </div>
        <Badge variant="warning" className="mt-1 text-xs">{t("community.badge")}</Badge>
      </div>

      <Card className="border-l-4 border-l-ring">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{t("community.whyMattersLabel")}</strong> {t("community.whyMatters")}
          </p>
        </CardContent>
      </Card>

      <Alert variant="warning">
        <AlertTriangle className="size-4" />
        <AlertDescription>{t("community.warning")}</AlertDescription>
      </Alert>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Trophy className="size-4 text-primary" />
          {t("community.priorityList")}
        </h3>
        <div className="flex flex-col gap-3">
          {priorities.map((rank) => (
            <Card key={rank} className="transition-all hover:shadow-md">
              <CardContent className="flex items-start gap-4 py-4">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {rank}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t(`community.priority.${rank}.name`)}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {t(`community.priority.${rank}.why`)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Leaf className="size-4 text-primary" />
          {t("community.bustingTitle")}
        </h3>
        <Card>
          <CardContent className="pt-4">
            <p className="mb-4 text-sm text-muted-foreground">{t("community.bustingDesc")}</p>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold">{t("community.substances")}</h4>
                <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  {(t("community.bustingSubstances", { returnObjects: true }) as string[]).map((item) => (
                    <li key={item.slice(0, 30)}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">{t("community.protocol")}</h4>
                <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  {(t("community.bustingProtocol", { returnObjects: true }) as string[]).map((item, i) => (
                    <li key={i}>
                      {i === 2 ? (
                        <><Badge variant="destructive" className="text-[0.68rem]">{t("community.bustingCritical")}</Badge>{" "}{item}</>
                      ) : (
                        <>• {item}</>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Sun className="size-4 text-primary" />
          {t("community.vitaminD")}
        </h3>
        <Card>
          <CardHeader>
            <CardDescription dangerouslySetInnerHTML={{ __html: t("community.vitaminDDesc") }} />
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold">{t("community.coreSupplement")}</h4>
                <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  {(t("community.d3Core", { returnObjects: true }) as string[]).map((item) => (
                    <li key={item.slice(0, 30)}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">{t("community.cofactors")}</h4>
                <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  {(t("community.d3Cofactors", { returnObjects: true }) as string[]).map((item) => (
                    <li key={item.slice(0, 30)}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {t("community.fullProtocol")}{" "}
              <a href="https://vitamindregimen.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                vitamindregimen.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

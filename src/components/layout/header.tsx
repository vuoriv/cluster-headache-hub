import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Brain, Sun, Moon, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"
import { LANGUAGES } from "@/i18n"

interface HeaderProps {
  trialCount: number | null
  recruitingCount: number | null
  paperCount: number | null
  psychedelicCount: number | null
  loading: boolean
}

function StatItem({ value, label, loading }: { value: string | number | null; label: string; loading?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3.5">
      <span className={cn(
        "text-3xl font-extrabold tracking-tight text-primary-foreground tabular-nums",
        loading && "animate-pulse opacity-40"
      )}>
        {value ?? "—"}
      </span>
      <span className="text-[0.7rem] font-medium uppercase tracking-wider text-primary-foreground/55">{label}</span>
    </div>
  )
}

export function Header({ trialCount, recruitingCount, paperCount, psychedelicCount, loading }: HeaderProps) {
  const [loadTime] = useState(() => new Date().toLocaleString())
  const { theme, setTheme } = useTheme()
  const { t, i18n } = useTranslation()

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : theme === "light" ? "dark" : "light")
  }

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
    localStorage.setItem("language", lang)
    document.documentElement.lang = lang
  }

  return (
    <header className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[oklch(0.25_0.10_260)]" />

      <div className="relative">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-5">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-primary-foreground/70">
              <Brain className="size-5 opacity-70" aria-hidden="true" />
              {t("header.siteName")}
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-primary-foreground/40 sm:inline">{loadTime}</span>
              <Select value={i18n.language} onValueChange={changeLanguage}>
                <SelectTrigger className="h-8 w-auto gap-1.5 border-0 bg-primary-foreground/10 px-2.5 text-xs text-primary-foreground/70 hover:bg-primary-foreground/15 hover:text-primary-foreground">
                  <Globe className="size-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.flag} {lang.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10"
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Hero */}
        <div className="mx-auto max-w-6xl px-6 pt-8 pb-6">
          <h1 className="max-w-2xl text-3xl font-bold leading-tight text-primary-foreground sm:text-4xl">
            {t("header.hero")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-primary-foreground/55">
            {t("header.subtitle")}
          </p>
        </div>

        {/* Stats */}
        <div className="border-t border-primary-foreground/8 px-6">
          <div className="mx-auto grid max-w-6xl grid-cols-2 divide-primary-foreground/8 sm:grid-cols-4 sm:divide-x">
            <StatItem value={trialCount} label={t("header.stats.activeTrials")} loading={loading} />
            <StatItem value={recruitingCount} label={t("header.stats.recruiting")} loading={loading} />
            <StatItem value={paperCount} label={t("header.stats.papers")} loading={loading} />
            <StatItem value={psychedelicCount} label={t("header.stats.psychedelicTrials")} loading={loading} />
          </div>
        </div>
      </div>
    </header>
  )
}

import { Link, NavLink } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Brain, Sun, Moon, FlaskConical, BookOpen, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"

const NAV_ITEMS = [
  { to: "/clusterbusters", label: "ClusterBusters", icon: MessageCircle },
  { to: "/research", label: "Research", icon: BookOpen },
  { to: "/trials", label: "Active Trials", icon: FlaskConical },
] as const

export function Header() {
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()

  const toggleTheme = () => {
    const isDark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    setTheme(isDark ? "light" : "dark")
  }

  return (
    <header className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[oklch(0.25_0.10_260)]" />

      <div className="relative">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-5">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm font-medium text-primary-foreground/70 transition-colors hover:text-primary-foreground"
            >
              <Brain className="size-5 opacity-70" aria-hidden="true" />
              {t("header.siteName")}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-4 border-t border-primary-foreground/8 px-6">
          <div className="mx-auto flex max-w-6xl gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "border-primary-foreground text-primary-foreground"
                      : "border-transparent text-primary-foreground/50 hover:text-primary-foreground/75",
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </header>
  )
}

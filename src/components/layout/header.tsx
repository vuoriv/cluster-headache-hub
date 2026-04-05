import { Link, NavLink } from "react-router-dom"
import { Brain, Sun, Moon, BookOpen, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"

const NAV_ITEMS = [
  { to: "/clusterbusters", label: "ClusterBusters", shortLabel: "CB", icon: MessageCircle },
  { to: "/research", label: "Research", shortLabel: "Research", icon: BookOpen },
] as const

export function Header() {
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    const isDark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    setTheme(isDark ? "light" : "dark")
  }

  return (
    <header className="bg-gradient-to-r from-primary via-primary to-[oklch(0.25_0.10_260)]">
      <div className="mx-auto flex max-w-6xl items-center gap-0.5 px-3 sm:gap-1 sm:px-6">
        <Link
          to="/"
          className="mr-1 flex items-center gap-1.5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:text-primary-foreground/80 sm:mr-3 sm:gap-2"
        >
          <Brain className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Home</span>
        </Link>

        <nav className="flex flex-1 items-center gap-0.5">
          {NAV_ITEMS.map(({ to, label, shortLabel, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-3 sm:text-sm",
                  isActive
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground",
                )
              }
            >
              <Icon className="size-3.5" />
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>
    </header>
  )
}

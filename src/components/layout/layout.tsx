import { Outlet } from "react-router-dom"
import { Header } from "./header"

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <Footer />
    </div>
  )
}

function Footer() {
  return (
    <footer className="border-t bg-muted/50 px-6 py-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-muted-foreground">
        <p className="font-medium">Not medical advice</p>
        <p>Built 2026</p>
      </div>
    </footer>
  )
}

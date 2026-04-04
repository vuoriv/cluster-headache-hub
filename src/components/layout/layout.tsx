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
    <footer className="border-t bg-muted/50 px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <p>
            Data from{" "}
            <a
              href="https://clinicaltrials.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground/70 hover:underline"
            >
              ClinicalTrials.gov
            </a>{" "}
            and{" "}
            <a
              href="https://pubmed.ncbi.nlm.nih.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground/70 hover:underline"
            >
              PubMed
            </a>{" "}
            via APIs.
          </p>
          <p>
            Community analysis from{" "}
            <a
              href="https://clusterbusters.org"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground/70 hover:underline"
            >
              ClusterBusters.org
            </a>{" "}
            forum (40K posts, 2009–2026) and patient survey literature.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
          <p className="font-medium">Not medical advice</p>
          <p>Built 2026</p>
        </div>
      </div>
    </footer>
  )
}

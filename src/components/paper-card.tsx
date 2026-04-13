import { useState } from "react"
import { Link } from "react-router-dom"
import { ChevronDown, ChevronUp, ExternalLink, FlaskConical } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useDataDb, type ResearchPaper } from "@/lib/data-db"
import { CATEGORY_CONFIG } from "@/lib/research-categories"

const OUTCOME_BADGES: Record<
  string,
  { label: string; variant: "success" | "destructive" | "warning" | "secondary" | "outline" }
> = {
  showed_benefit: { label: "Showed Benefit", variant: "success" },
  no_benefit: { label: "No Benefit", variant: "destructive" },
  mixed: { label: "Mixed", variant: "warning" },
  inconclusive: { label: "Inconclusive", variant: "secondary" },
  basic_science: { label: "Basic Science", variant: "outline" },
  positive: { label: "Showed Benefit", variant: "success" },
  negative: { label: "No Benefit", variant: "destructive" },
}

const STUDY_TYPE_LABELS: Record<string, string> = {
  rct: "Clinical Trial (RCT)",
  "clinical-trial": "Clinical Trial",
  "meta-analysis": "Meta-Analysis",
  "systematic-review": "Systematic Review",
  observational: "Observational",
  "case-report": "Case Report",
  "case-series": "Case Series",
  review: "Review",
  "basic-science": "Basic Science",
  guideline: "Guideline",
  protocol: "Protocol",
  editorial: "Editorial",
  other: "Other",
}

function decodeHtmlEntities(text: string): string {
  if (!text || !text.includes("&")) return text
  const el = document.createElement("textarea")
  el.innerHTML = text
  return el.value
}

export function PaperCard({
  paper,
  showCategory = false,
  expanded: controlledExpanded,
  onToggle,
  onAuthorClick,
}: {
  paper: ResearchPaper
  showCategory?: boolean
  expanded?: boolean
  onToggle?: () => void
  onAuthorClick?: (author: string) => void
}) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const expanded = controlledExpanded ?? internalExpanded
  const toggle = onToggle ?? (() => setInternalExpanded(!internalExpanded))
  const { getPaperAnalysis, getLinkedTrials } = useDataDb()
  const analysis = getPaperAnalysis(paper.pmid)
  const linkedTrials = getLinkedTrials(paper.pmid)
  const catConfig = CATEGORY_CONFIG[paper.category]
  const year = paper.pubDate?.slice(0, 4) || ""
  const firstAuthor = paper.authors?.split(",")[0]?.trim()

  return (
    <Card className="transition-all hover:shadow-sm">
      <CardHeader
        className="cursor-pointer pb-2"
        onClick={toggle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold leading-snug">
              {decodeHtmlEntities(paper.title)}
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              {firstAuthor && onAuthorClick ? (
                <button
                  className="font-medium text-foreground/70 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAuthorClick(firstAuthor)
                  }}
                >
                  {firstAuthor}
                </button>
              ) : firstAuthor ? (
                <span className="font-medium text-foreground/70">
                  {firstAuthor}
                </span>
              ) : null}
              {paper.authors?.includes(",") && (
                <span>, {paper.authors.split(",").slice(1).join(",")}</span>
              )}
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {showCategory && catConfig && (
            <Badge variant={catConfig.variant} className="text-[0.65rem]">
              {catConfig.label}
            </Badge>
          )}
          {analysis?.outcome && OUTCOME_BADGES[analysis.outcome] && (
            <Badge variant={OUTCOME_BADGES[analysis.outcome].variant}>
              {OUTCOME_BADGES[analysis.outcome].label}
            </Badge>
          )}
          {analysis?.studyType && (
            <Badge variant="outline" className="text-[0.6rem]">
              {STUDY_TYPE_LABELS[analysis.studyType] ?? analysis.studyType}
            </Badge>
          )}
          {analysis?.evidenceTier && (
            <Badge variant="outline" className="text-[0.6rem]">
              Tier {analysis.evidenceTier}
            </Badge>
          )}
          {year && (
            <Badge variant="outline" className="text-[0.65rem]">
              {year}
            </Badge>
          )}
          {analysis?.sampleSize && (
            <span className="text-[0.6rem] text-muted-foreground">
              n={analysis.sampleSize}
            </span>
          )}
          {paper.isOa && paper.oaUrl && (
            <a
              href={paper.oaUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <Badge variant="success" className="text-[0.6rem]">
                Open Access
              </Badge>
            </a>
          )}
          <span className="text-[0.65rem] text-muted-foreground">
            {paper.journal}
          </span>
        </div>

        {!expanded && (
          <>
            {analysis?.plainSummary ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                {decodeHtmlEntities(analysis.plainSummary)}
              </p>
            ) : paper.abstract ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                {decodeHtmlEntities(paper.abstract)}
              </p>
            ) : null}
            {analysis?.keyFinding && (
              <p className="mt-1 text-xs font-medium">
                {decodeHtmlEntities(analysis.keyFinding)}
              </p>
            )}
          </>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {paper.abstract ? (
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              {decodeHtmlEntities(paper.abstract)}
            </p>
          ) : (
            <p className="mb-3 text-xs italic text-muted-foreground/60">
              No abstract available
            </p>
          )}

          {paper.meshTerms.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {paper.meshTerms.slice(0, 8).map((term) => (
                <Badge key={term} variant="secondary" className="text-[0.6rem]">
                  {term}
                </Badge>
              ))}
            </div>
          )}

          {linkedTrials.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <p className="mb-2 text-xs font-medium">Linked Clinical Trials</p>
              <div className="flex flex-col gap-1">
                {linkedTrials.map((trial) => (
                  <Link
                    key={trial.nctId}
                    to={`/trials?q=${trial.nctId}`}
                    className="flex items-center gap-2 text-xs text-primary hover:underline"
                  >
                    <FlaskConical className="size-3 shrink-0" />
                    <span className="truncate">
                      {trial.nctId} — {trial.title}
                    </span>
                    <Badge
                      variant={
                        trial.linkType === "confirmed" ? "info" : "outline"
                      }
                      className="shrink-0 text-[0.5rem]"
                    >
                      {trial.linkType}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View on PubMed <ExternalLink className="size-3" />
          </a>
        </CardContent>
      )}
    </Card>
  )
}

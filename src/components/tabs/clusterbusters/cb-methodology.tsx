import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Database, Cpu, Calculator, AlertTriangle, Lock, FlaskConical } from "lucide-react"

interface CbMethodologyProps {
  onNavigate: (path: string) => void
}

const PIPELINE_STEPS = [
  {
    icon: Database,
    title: "1. Data Collection",
    description:
      "Forum posts scraped from ClusterBusters.org public discussion boards covering 2009-2026. Raw corpus: ~40,000 posts across 7 forum sections.",
  },
  {
    icon: Cpu,
    title: "2. NLP Processing",
    description:
      "Treatment mentions identified using keyword matching with medical synonym expansion. Sentiment classified using a fine-tuned model into positive, negative, partial, mixed, and neutral categories.",
  },
  {
    icon: Calculator,
    title: "3. Scoring & Ranking",
    description:
      "Composite score = 0.6 * positive_rate + 0.4 * normalized_mentions. Positive rate calculated as positive / (positive + negative + partial + mixed) per treatment. Volume normalized to 0-1 scale.",
  },
  {
    icon: FlaskConical,
    title: "4. Validation",
    description:
      "Results cross-referenced with published clinical literature (Schindler et al. 2015, NICE guidelines). Rankings broadly consistent with patient survey data, providing convergent validity.",
  },
]

export function CbMethodology({ onNavigate }: CbMethodologyProps) {
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink className="cursor-pointer" onClick={() => onNavigate("")}>
              ClusterBusters
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Methodology</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h2 className="text-2xl font-bold">Methodology</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          How we collected, processed, and analyzed ClusterBusters forum data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="size-4 text-primary" />
            Data Source
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            ClusterBusters (<a href="https://clusterbusters.org" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground/70 hover:underline">clusterbusters.org</a>)
            is a US-based non-profit dedicated to researching effective treatments for cluster headaches.
            Their forum is one of the largest patient communities, with members sharing treatment experiences since 2009.
          </p>
          <p>
            We analyzed <strong>37,868 cleaned posts</strong> across <strong>7,869 topics</strong> from 7 forum sections,
            with the heaviest activity in "Share Your Busting Stories" and "Theory & Implementation".
          </p>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-4 text-lg font-semibold">Analysis Pipeline</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {PIPELINE_STEPS.map((step) => (
            <Card key={step.title}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <step.icon className="size-4 text-primary" />
                  {step.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="size-4 text-primary" />
            Treatment Selection & Ranking Formula
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Treatments were included if they had at least 200 total mentions across the corpus.
            This threshold ensures sufficient data for meaningful sentiment analysis while capturing
            both mainstream and alternative treatments discussed in the community.
          </p>
          <div className="rounded-lg bg-muted p-4 font-mono text-xs">
            <p>composite_score = 0.6 * positive_rate + 0.4 * normalized_mentions</p>
            <p className="mt-1 text-muted-foreground">where:</p>
            <p className="ml-4">positive_rate = positive / (positive + negative + partial + mixed)</p>
            <p className="ml-4">normalized_mentions = treatment_mentions / max_mentions</p>
          </div>
          <p>
            The 60/40 weighting prioritizes treatment effectiveness (positive rate) while still
            rewarding treatments that are widely discussed, as higher volume provides more statistical confidence.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-destructive" />
            Limitations & Biases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Selection Bias</p>
              <p>
                ClusterBusters community skews toward patients interested in alternative and psychedelic
                treatments. Members who respond well to conventional medicine may be underrepresented.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Self-Report Bias</p>
              <p>
                All data is self-reported. Positive outcomes may be overreported (people post when
                something works), and dosing/timing details are approximate. No clinical verification.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Temporal Bias</p>
              <p>
                Forum activity peaked in 2010-2012 and has gradually declined as members moved to
                Facebook groups and other platforms. Recent years have lower sample sizes.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Variable Sample Sizes</p>
              <p>
                Psilocybin has 13,000+ mentions while BOL-148 has only 223. Treatments with fewer
                mentions have wider confidence intervals and less reliable positive rates.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="size-4 text-primary" />
            Open Source & Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            All analysis code and aggregated data are open source. No individual usernames, email addresses,
            or personally identifiable information is stored or displayed. All data is presented in aggregate form only.
          </p>
          <p>
            The raw forum posts are publicly available on ClusterBusters.org. Our analysis pipeline
            processes text content only and discards all author metadata before aggregation.
          </p>
        </CardContent>
      </Card>

      <Alert>
        <AlertDescription>
          This analysis is provided for informational and research purposes only. It does not constitute medical advice.
          Treatment decisions should always be made in consultation with a qualified headache specialist.
        </AlertDescription>
      </Alert>
    </div>
  )
}

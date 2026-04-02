import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

const RESOURCES = [
  { href: "https://clusterbusters.org", label: "Clusterbusters.org" },
  { href: "https://www.reddit.com/r/clusterheadaches", label: "r/ClusterHeadaches" },
  { href: "https://ouchuk.org", label: "OUCH UK" },
  { href: "https://clusterfree.org", label: "ClusterFree.org" },
  { href: "https://vitamindregimen.com", label: "Vitamin D3 Regimen" },
  { href: "https://clusterheadachewarriors.org", label: "CH Warriors" },
  { href: "https://migrainedisorders.org/cluster-headache-guide", label: "AMD CH Guide (for doctors)" },
]

export function OverviewTab() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">What Is Cluster Headache?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Key facts, epidemiology, and the current research landscape</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">⚡ The Basics</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Pain:</strong> Excruciating unilateral orbital, supraorbital, or temporal pain lasting 15–180 minutes — often called "suicide headache"</li>
              <li><strong className="text-foreground">Autonomic features:</strong> Tearing, red eye, drooping eyelid, nasal congestion, sweating — all on the pain side</li>
              <li><strong className="text-foreground">Pattern:</strong> 1–8 attacks/day, frequently occurring during sleep, clustering in periods of weeks to months</li>
              <li><strong className="text-foreground">Types:</strong> Episodic (cycles with remission) vs. Chronic (no remission &gt;3 months)</li>
              <li><strong className="text-foreground">Prevalence:</strong> ~0.1% of population; 3–4× more common in men historically, though the gender gap is narrowing</li>
              <li><strong className="text-foreground">Key pathways:</strong> Hypothalamus (circadian timing) + trigeminal-autonomic reflex (pain generation)</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">🔬 Current Research Focus Areas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Psychedelics:</strong> Multiple Phase 2 LSD RCTs actively recruiting; psilocybin trials publishing results</li>
              <li><strong className="text-foreground">CGRP pathway:</strong> Galcanezumab approved for episodic CH; others showed mixed results</li>
              <li><strong className="text-foreground">Sleep-hypothalamus axis:</strong> SUNCET trial testing sodium oxybate for nocturnal attacks in chronic CH</li>
              <li><strong className="text-foreground">Neuromodulation:</strong> New implantable combined trigeminal+occipital stimulator (PRIMUS)</li>
              <li><strong className="text-foreground">Genetics:</strong> Multiple risk loci identified in recent GWAS studies (Harder et al., Dahl et al.)</li>
              <li><strong className="text-foreground">Biomarkers:</strong> MicroRNA profiling underway at IRCCS Mondino, Italy</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">💊 What's Currently Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Acute:</strong> High-flow O₂ (most effective), SC sumatriptan 6mg, intranasal zolmitriptan 5mg</li>
              <li><strong className="text-foreground">Preventive:</strong> Verapamil (first-line), lithium, galcanezumab (Emgality — episodic only)</li>
              <li><strong className="text-foreground">Transitional:</strong> Greater occipital nerve block, short prednisone course</li>
              <li><strong className="text-foreground">Device:</strong> gammaCore (FDA-cleared nVNS) for episodic acute &amp; chronic prevention</li>
            </ul>
          </CardContent>
        </Card>

        <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="size-4" />
          <AlertTitle>Medical Disclaimer</AlertTitle>
          <AlertDescription className="text-sm">
            This site is for <strong>informational purposes only</strong> and does not constitute medical advice. All clinical trial information is sourced directly from ClinicalTrials.gov. Some substances discussed (psilocybin, LSD, LSA) are controlled or illegal in many jurisdictions — this site does not advocate their use. Always consult a qualified healthcare professional before changing your treatment.
          </AlertDescription>
        </Alert>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">📡 Key Patient Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {RESOURCES.map((r) => (
              <a
                key={r.href}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {r.label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

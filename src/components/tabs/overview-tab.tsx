import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Zap, Microscope, Pill, Globe } from "lucide-react"

const RESOURCES = [
  { href: "https://clusterbusters.org", label: "Clusterbusters.org" },
  { href: "https://www.reddit.com/r/clusterheadaches", label: "r/ClusterHeadaches" },
  { href: "https://ouchuk.org", label: "OUCH UK" },
  { href: "https://clusterfree.org", label: "ClusterFree.org" },
  { href: "https://vitamindregimen.com", label: "Vitamin D3 Regimen" },
  { href: "https://clusterheadachewarriors.org", label: "CH Warriors" },
  { href: "https://migrainedisorders.org/cluster-headache-guide", label: "AMD CH Guide (for doctors)" },
]


function SectionIcon({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">{children}</span>
}

export function OverviewTab() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">What Is Cluster Headache?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Key facts, epidemiology, and the current research landscape</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-accent/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><SectionIcon><Zap className="size-4" /></SectionIcon>The Basics</CardTitle>
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
            <CardTitle className="flex items-center gap-2 text-base"><SectionIcon><Microscope className="size-4" /></SectionIcon>Current Research Focus Areas</CardTitle>
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
            <CardTitle className="flex items-center gap-2 text-base"><SectionIcon><Pill className="size-4" /></SectionIcon>What's Currently Approved</CardTitle>
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

        <Alert variant="warning">
          <AlertTriangle className="size-4" />
          <AlertTitle>Medical Disclaimer</AlertTitle>
          <AlertDescription className="text-sm">
            This site is for <strong>informational purposes only</strong> and does not constitute medical advice. All clinical trial information is sourced directly from ClinicalTrials.gov. Some substances discussed (psilocybin, LSD, LSA) are controlled or illegal in many jurisdictions — this site does not advocate their use. Always consult a qualified healthcare professional before changing your treatment.
          </AlertDescription>
        </Alert>
      </div>

      <Card className="border-l-4 border-l-destructive bg-destructive/3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><SectionIcon><AlertTriangle className="size-4" /></SectionIcon>The Treatment Gap — What New Patients Need to Know</CardTitle>
          <CardDescription>
            Most CH patients spend years receiving ineffective or counterproductive treatment before finding what actually works.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
            <li><strong className="text-foreground">Average diagnostic delay: 5+ years.</strong> CH is frequently misdiagnosed as migraine, sinusitis, or dental pain. Many patients see 5+ doctors before getting the correct diagnosis.</li>
            <li><strong className="text-foreground">Oxygen is the #1 abortive — but most doctors don't prescribe it.</strong> High-flow O₂ is the safest, fastest, most effective treatment with zero side effects. Yet many patients go years without being offered it. If your doctor hasn't mentioned oxygen, ask — or find a headache specialist who will.</li>
            <li><strong className="text-foreground">Common prescribing failures:</strong> Oral triptans (too slow — only SC injection works for CH), standard migraine preventives (topiramate, amitriptyline — ineffective for CH), opioids (don't work, create dependency), and verapamil dosed too low (&lt;360mg is usually insufficient).</li>
            <li><strong className="text-foreground">Medications that can make things worse:</strong> SSRIs and SNRIs can increase attack frequency for some patients and block psychedelic treatments. Beta-blockers are ineffective. Overuse of triptans can cause rebound.</li>
            <li><strong className="text-foreground">Patient community knowledge saves lives.</strong> Treatments like the Vitamin D3 regimen (80% responder rate in surveys), busting protocols (now in Phase 2 trials), and high-flow oxygen technique refinements all came from patients sharing what works — often years before clinical research caught up.</li>
          </ul>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><SectionIcon><Globe className="size-4" /></SectionIcon>Key Patient Resources</CardTitle>
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

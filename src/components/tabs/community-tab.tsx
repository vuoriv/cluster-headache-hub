import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle } from "lucide-react"

const PRIORITY_LIST = [
  { rank: 1, name: "High-flow O₂ (12–25 L/min, NRB mask)", why: "Fastest, safest, most effective abortive. Get it prescribed first. Clusterbusters has free doctor letter templates." },
  { rank: 2, name: "SC sumatriptan 6mg", why: "Best pharmaceutical abortive when O₂ unavailable. Onset ~10 min. Keep on you at all times." },
  { rank: 3, name: "Energy drink at shadow onset", why: "Caffeine + taurine at the very first sign. Free, instant, works for some. Nothing to lose by trying." },
  { rank: 4, name: "Melatonin 10–25mg at bedtime", why: "Safe OTC, RCT-backed for nocturnal attacks. Take well before usual attack time." },
  { rank: 5, name: "Verapamil (push for 360–960mg)", why: "Standard first-line preventive. Most GPs dose too low. Ask for a referral to a headache specialist." },
  { rank: 6, name: "Vitamin D3 Batch Protocol", why: "80% of survey respondents report significant improvement. Start early in cycle. See vitamindregimen.com." },
  { rank: 7, name: "GON block (bridge therapy)", why: "Ask neurologist. Fast-acting bridge while verapamil takes effect. Can break an active cycle." },
  { rank: 8, name: "Busting (psilocybin/LSA seeds)", why: "Last resort for many; transforms life for some. Read Clusterbusters forums thoroughly before attempting. Now in Phase 2 RCTs." },
]

export function CommunityTab() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Patient Community Treatments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Empirical knowledge from Clusterbusters, r/ClusterHeadaches, and CH patient groups — not medical advice
          </p>
        </div>
        <Badge variant="warning" className="mt-1 text-xs">Patient-Reported / Empirical</Badge>
      </div>

      <Card className="border-l-4 border-l-ring">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Why this tab matters:</strong> Many of the most effective CH treatments were discovered by patients, not doctors. High-flow oxygen technique refinements, the Vitamin D3 regimen, energy drinks at shadow onset, and the psychedelic busting protocol — all came from patients sharing what works. Several are now being validated in clinical trials, but the community was using them effectively for years before research caught up. If your doctor's treatment plan isn't working, the knowledge here may change your life.
          </p>
        </CardContent>
      </Card>

      <Alert variant="warning">
        <AlertTriangle className="size-4" />
        <AlertDescription>
          These treatments are reported by patients and are not all officially approved. Always discuss with your doctor — but know that many CH patients find their best treatment through community knowledge, not their initial prescription.
        </AlertDescription>
      </Alert>

      <div>
        <h3 className="mb-3 text-base font-semibold">🏆 Community Priority List</h3>
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Treatment</TableHead>
                <TableHead>Why the community prioritises it</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PRIORITY_LIST.map((item) => (
                <TableRow key={item.rank}>
                  <TableCell className="font-bold">{item.rank}</TableCell>
                  <TableCell className="font-semibold">{item.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.why}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-base font-semibold">🍄 The Busting Protocol (Clusterbusters)</h3>
        <Card>
          <CardContent className="pt-4">
            <p className="mb-4 text-sm text-muted-foreground">
              "Busting" is the patient-community term for using psychedelic substances to break CH cycles.
              Popularized and formally organized by Bob Wold, who founded Clusterbusters after his own experience.
              Now being evaluated in Phase 2 clinical trials.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold">Substances used</h4>
                <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  <li>• Psilocybin mushrooms (most common): 0.5–1.5g dried (sub-psychedelic) or 1.5–3.5g</li>
                  <li>• LSD: micro to low dose</li>
                  <li>• LSA seeds: Rivea corymbosa (50–100 seeds) or Hawaiian Baby Woodrose (4–8 seeds). Potency varies greatly by batch — consult Clusterbusters forums for current dosing guidance</li>
                </ul>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Protocol</h4>
                <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  <li>• Dose every 5 days (prevents serotonin tolerance)</li>
                  <li>• Typical course: 3 doses; many report cycle breaking after 1–2</li>
                  <li>
                    • <Badge variant="destructive" className="text-[0.68rem]">CRITICAL</Badge>{" "}
                    Stop triptans 5+ days before. SSRIs/SNRIs require much longer washout (2–5 weeks depending on drug) — consult your doctor before stopping any antidepressant
                  </li>
                  <li>• Join Clusterbusters forums before attempting</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-base font-semibold">☀️ Vitamin D3 Anti-Inflammatory Regimen (Batch Protocol)</h3>
        <Card>
          <CardHeader>
            <CardDescription>
              Developed by Pete Batcheller (CH sufferer, retired Navy pilot). Survey of 110 patients:{" "}
              <strong className="text-foreground">80% reported significant reduction</strong> in frequency, duration, and severity.
              Formal clinical trial NCT04570475 ongoing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold">Core supplement</h4>
                <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  <li>• Vitamin D3: 10,000 IU/day starting dose</li>
                  <li>• Some titrate to 20,000–50,000 IU based on blood tests</li>
                  <li>• Takes 2–4 weeks to show effect</li>
                </ul>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Essential cofactors (do not skip)</h4>
                <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  <li>• Vitamin K2 (MK-7): 100–200 mcg/day</li>
                  <li>• Magnesium glycinate/malate: 400–800 mg/day</li>
                  <li>• Omega-3 fish oil: 3–6g/day</li>
                  <li>• Boron: 3 mg/day; Zinc: 15–25 mg/day</li>
                  <li>• Vitamin A (retinol): 5,000 IU/day</li>
                </ul>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Full protocol:{" "}
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

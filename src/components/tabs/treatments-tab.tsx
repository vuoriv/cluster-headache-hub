import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface TreatmentProps {
  title: string
  badge: string
  badgeClass: string
  borderClass: string
  items: string[]
  note?: string
}

function TreatmentCard({ title, badge, badgeClass, borderClass, items, note }: TreatmentProps) {
  return (
    <Card className={`border-l-4 ${borderClass}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          {title}
          <Badge variant="secondary" className={`text-[0.68rem] ${badgeClass}`}>{badge}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {items.map((item, i) => (
            <li key={i}>• {item}</li>
          ))}
        </ul>
        {note && <p className="mt-2 text-xs text-muted-foreground italic">{note}</p>}
      </CardContent>
    </Card>
  )
}

export function TreatmentsTab() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold">Clinical Treatments</h2>
        <p className="mt-1 text-sm text-muted-foreground">Evidence-based treatments — approved drugs, devices, and procedural options</p>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold">⚡ Acute Abortives</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TreatmentCard
            title="🫁 High-Flow Oxygen"
            badge="First-line ✓"
            badgeClass="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
            borderClass="border-l-green-500"
            items={[
              "12–25 L/min via non-rebreather (NRB) mask",
              "78% efficacy in pivotal RCT (Cohen 2009, BMJ) at 12 L/min; higher flows often more effective",
              "15–25 min duration or until resolved",
              "Hyperventilation technique speeds abort",
              "Demand-valve mask: fastest community method",
            ]}
          />
          <TreatmentCard
            title="💉 Sumatriptan SC 6mg"
            badge="First-line ✓"
            badgeClass="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
            borderClass="border-l-blue-500"
            items={[
              "Onset ~10 minutes; most reliable pharma abortive",
              "Subcutaneous injection only (oral too slow)",
              "Intranasal zolmitriptan 5mg as alternative",
              "Triptans block serotonergic treatments (see Community tab for details)",
              "Limit use to avoid medication overuse",
            ]}
          />
          <TreatmentCard
            title="🔌 gammaCore (nVNS)"
            badge="FDA-cleared"
            badgeClass="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            borderClass="border-l-amber-500"
            items={[
              "Non-invasive vagus nerve stimulator (neck device)",
              "FDA-cleared: acute episodic + prevention chronic CH",
              "ACT1/ACT2 trials: superior to sham for episodic CH",
              "PREVA trial: superior to standard care alone (chronic)",
              "Can be used at home, no prescription for device",
            ]}
          />
          <TreatmentCard
            title="💊 Civamide (Zucapsaicin)"
            badge="Phase 3 completed"
            badgeClass="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
            borderClass="border-l-purple-500"
            items={[
              "Synthetic capsaicin analogue, intranasal",
              "Phase 3 trials showed efficacy for episodic CH",
              "Development stalled; not commercially available",
              "Depletes substance P from trigeminal fibers",
            ]}
          />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-base font-semibold">🛡️ Preventive Treatments</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TreatmentCard
            title="💊 Verapamil"
            badge="First-line ✓"
            badgeClass="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
            borderClass="border-l-green-500"
            items={[
              "Most widely used preventive; onset 2–3 weeks",
              "Effective dose: 360–960 mg/day (divided doses)",
              "ECG monitoring required at higher doses (AV block risk)",
              "Active cardiac safety trial: NCT04406259 (Nice, FR)",
              "Bridge with GON block or prednisone while starting",
            ]}
          />
          <TreatmentCard
            title="💊 Galcanezumab (Emgality)"
            badge="FDA-approved ✓"
            badgeClass="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
            borderClass="border-l-green-500"
            items={[
              "Only anti-CGRP mAb approved for CH (episodic only)",
              "Monthly 300mg injection; onset within days",
              "Did not meet primary endpoints in chronic CH trials",
              "Fremanezumab & erenumab: negative in CH trials",
              "Eptinezumab: mixed results, some benefit at week 4",
            ]}
          />
          <TreatmentCard
            title="💊 Lithium"
            badge="Second-line"
            badgeClass="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            borderClass="border-l-red-500"
            items={[
              "Effective for chronic CH, especially refractory",
              "Narrow therapeutic window (0.6–1.2 mEq/L)",
              "Regular blood monitoring required",
              "Consider with verapamil under specialist supervision",
            ]}
          />
          <TreatmentCard
            title="💊 Melatonin (10–25mg)"
            badge="Adjunct option"
            badgeClass="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            borderClass="border-l-amber-500"
            items={[
              "RCT: 50% responder rate at 10mg at bedtime (n=20)",
              "Particularly effective for nocturnal attacks",
              "Excellent tolerability; OTC in most countries",
              "10mg is the RCT-studied dose; doses above this are empirical",
            ]}
          />
          <TreatmentCard
            title="💉 GON Block"
            badge="Transitional ✓"
            badgeClass="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
            borderClass="border-l-blue-500"
            items={[
              "Corticosteroid + local anesthetic at skull base",
              "Onset 24–72h; duration 2–8 weeks",
              "Use as bridge while verapamil takes effect",
              "Phase 3 trial ongoing: NCT05324748 (Leiden)",
              "Also: repeated GON blocks being studied as prevention",
            ]}
          />
          <TreatmentCard
            title="🧠 SPG Stimulation"
            badge="Refractory CH"
            badgeClass="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
            borderClass="border-l-purple-500"
            items={[
              "Implantable sphenopalatine ganglion neurostimulator",
              "On-demand acute relief; strong evidence base",
              "For refractory cases when medications fail",
              "Pulsed radiofrequency (PRF) non-implant alternative in trials (NCT06787677)",
            ]}
          />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-base font-semibold">🔬 In Active Clinical Trials</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TreatmentCard
            title="🍄 Psilocybin"
            badge="Phase 2"
            badgeClass="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
            borderClass="border-l-violet-500"
            items={[
              "Repeat pulse reduces attacks by 50% (2024 RCT)",
              "Australian MRFF-funded trial underway (2025)",
              "Health Canada: first-ever legal access for CH (2024)",
              "Sub-hallucinogenic doses appear sufficient",
            ]}
          />
          <TreatmentCard
            title="🔬 LSD (Micro/Low Dose)"
            badge="Phase 2"
            badgeClass="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
            borderClass="border-l-violet-500"
            items={[
              "Basel RCT: 3×100µg, double-blind crossover (NCT03781128)",
              "Radboud RCT: minidosing for chronic CH (NCT05477459)",
              "Both recruiting; results expected 2025–2027",
              "Community use (\"busting\") for 20+ years",
            ]}
          />
          <TreatmentCard
            title="💉 Ketamine + Magnesium IV"
            badge="Phase 4 (KETALGIA)"
            badgeClass="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
            borderClass="border-l-cyan-500"
            items={[
              "Single IV infusion for refractory chronic CH",
              "Pilot: 13/17 patients ≥50% attack reduction",
              "14 sites in France; 90 patients (NCT04814381)",
              "Primary completion Sep 2026",
            ]}
            note="Phase 4 designation reflects ketamine's approved status for other indications (anesthesia), not for CH."
          />
          <TreatmentCard
            title="😴 Sodium Oxybate (SUNCET)"
            badge="Phase 2"
            badgeClass="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
            borderClass="border-l-cyan-500"
            items={[
              "Targets nocturnal CH via sleep deepening (↑SWS, ↓REM)",
              "RCT at Leiden University (NCT06950281)",
              "n=52; starts Jan 2026; results expected Dec 2027",
              "Wearable sleep monitoring included",
            ]}
          />
          <TreatmentCard
            title="☀️ Light Therapy"
            badge="Proof of concept"
            badgeClass="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            borderClass="border-l-yellow-500"
            items={[
              "Luminettes® device for chronic CH prevention",
              "Hypothesis: circadian/hypothalamic reset",
              "n=48, Marseille (NCT06540651); ends Feb 2027",
            ]}
          />
          <TreatmentCard
            title="💉 Botulinum Toxin A (SPG)"
            badge="Phase 3"
            badgeClass="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            borderClass="border-l-yellow-500"
            items={[
              "SPG blockade with BoNT-A for refractory chronic CH",
              "5 European sites; 112 patients (NCT03944876)",
              "Norwegian University of Science & Technology",
              "Primary completion Sep 2025",
            ]}
          />
        </div>
      </div>
    </div>
  )
}

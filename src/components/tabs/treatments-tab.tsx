import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Zap, Shield, FlaskConical, Ban, Star } from "lucide-react"

type BadgeVariant = "success" | "info" | "warning" | "purple" | "cyan" | "amber" | "danger" | "secondary" | "outline"
type AccentColor = "primary" | "destructive" | "muted"

interface TreatmentProps {
  title: string
  badge: string
  badgeVariant?: BadgeVariant
  accent?: AccentColor
  items: string[]
  note?: string
}

function TreatmentCard({ title, badge, badgeVariant = "secondary", accent = "primary", items, note }: TreatmentProps) {
  return (
    <Card className={cn("border-l-4", accent === "destructive" ? "border-l-destructive" : "border-l-ring")}>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          {title}
          <Badge variant={badgeVariant} className="text-[0.68rem]">{badge}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
        {note && <p className="mt-2 text-xs text-muted-foreground italic">{note}</p>}
      </CardContent>
    </Card>
  )
}

export function TreatmentsTab() {
    const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{t("treatments.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("treatments.subtitle")}</p>
        </div>
        <Badge variant="outline" className="mt-1 text-xs">{t("treatments.badge")}</Badge>
      </div>

      <Alert variant="warning">
        <AlertTriangle className="size-4" />
        <AlertDescription>
          <strong>For newly diagnosed patients:</strong> Many GPs and neurologists are not CH specialists and may prescribe treatments that are ineffective or counterproductive for cluster headache (oral triptans, standard migraine preventives, opioids). If your current treatment isn't working, seek a headache specialist and explore the Community tab for patient-tested approaches.
        </AlertDescription>
      </Alert>

      <Card className="border-2 border-ring">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="size-4 text-primary" />
            What Actually Works — Community Consensus vs Standard Care
          </CardTitle>
          <CardDescription>
            Based on decades of patient experience from Clusterbusters, r/ClusterHeadaches, and patient surveys. Many of these are now validated by clinical research.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Treatment</TableHead>
                <TableHead>Community view</TableHead>
                <TableHead className="w-[140px]">Typical doctor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-bold text-primary">1</TableCell>
                <TableCell className="font-semibold">High-flow O₂ (15–25 L/min)</TableCell>
                <TableCell className="text-sm text-muted-foreground">The #1 treatment. Get this first. 78% efficacy, zero side effects. Demand-valve mask is fastest.</TableCell>
                <TableCell><Badge variant="danger" className="text-[0.65rem]">Often not prescribed</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-bold text-primary">2</TableCell>
                <TableCell className="font-semibold">Vitamin D3 Batch Protocol</TableCell>
                <TableCell className="text-sm text-muted-foreground">80% responder rate in surveys. Start at 10,000 IU/day with cofactors (K2, Mg, Omega-3). Begin early in cycle.</TableCell>
                <TableCell><Badge variant="warning" className="text-[0.65rem]">Rarely mentioned</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-bold text-primary">3</TableCell>
                <TableCell className="font-semibold">SC sumatriptan 6mg</TableCell>
                <TableCell className="text-sm text-muted-foreground">Best pharma abortive when O₂ unavailable. Injection only — oral is useless for CH. Carry at all times.</TableCell>
                <TableCell><Badge variant="success" className="text-[0.65rem]">Usually prescribed</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-bold text-primary">4</TableCell>
                <TableCell className="font-semibold">Energy drink at shadow onset</TableCell>
                <TableCell className="text-sm text-muted-foreground">Caffeine + taurine at first sign of an attack. Free, instant, no side effects. Works for many.</TableCell>
                <TableCell><Badge variant="warning" className="text-[0.65rem]">Not discussed</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-bold text-primary">5</TableCell>
                <TableCell className="font-semibold">Melatonin 10–25mg</TableCell>
                <TableCell className="text-sm text-muted-foreground">RCT-backed at 10mg. Much higher than sleep dosing. Take before usual attack time. OTC, safe.</TableCell>
                <TableCell><Badge variant="warning" className="text-[0.65rem]">Underdosed if mentioned</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-bold text-primary">6</TableCell>
                <TableCell className="font-semibold">Verapamil (360–960mg)</TableCell>
                <TableCell className="text-sm text-muted-foreground">Standard preventive but must be dosed high enough. Most GPs start too low. Push for headache specialist dosing.</TableCell>
                <TableCell><Badge variant="info" className="text-[0.65rem]">Often underdosed</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-bold text-primary">7</TableCell>
                <TableCell className="font-semibold">GON block (bridge)</TableCell>
                <TableCell className="text-sm text-muted-foreground">Fast-acting bridge while verapamil takes effect. Can break an active cycle. Ask neurologist.</TableCell>
                <TableCell><Badge variant="success" className="text-[0.65rem]">Specialist-level</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-bold text-primary">8</TableCell>
                <TableCell className="font-semibold">Busting (psilocybin/LSA)</TableCell>
                <TableCell className="text-sm text-muted-foreground">Life-changing for many refractory patients. Now in Phase 2 RCTs. See Community tab for protocol.</TableCell>
                <TableCell><Badge variant="danger" className="text-[0.65rem]">Not discussed</Badge></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Separator />

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Zap className="size-4 text-primary" />{t("treatments.acute")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TreatmentCard
            title="🫁 High-Flow Oxygen"
            badge="First-line ✓"
            badgeVariant="success"
            accent="primary"
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
            badgeVariant="info"
            accent="primary"
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
            badgeVariant="amber"
            accent="primary"
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
            badgeVariant="purple"
            accent="primary"
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
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Shield className="size-4 text-primary" />{t("treatments.preventive")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TreatmentCard
            title="💊 Verapamil"
            badge="First-line ✓"
            badgeVariant="success"
            accent="primary"
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
            badgeVariant="success"
            accent="primary"
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
            badgeVariant="amber"
            accent="destructive"
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
            badgeVariant="amber"
            accent="primary"
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
            badgeVariant="info"
            accent="primary"
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
            badgeVariant="purple"
            accent="primary"
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
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><FlaskConical className="size-4 text-primary" />{t("treatments.inTrials")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TreatmentCard
            title="🍄 Psilocybin"
            badge="Phase 2"
            badgeVariant="purple"
            accent="primary"
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
            badgeVariant="purple"
            accent="primary"
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
            badgeVariant="info"
            accent="primary"
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
            badgeVariant="info"
            accent="primary"
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
            badgeVariant="amber"
            accent="primary"
            items={[
              "Luminettes® device for chronic CH prevention",
              "Hypothesis: circadian/hypothalamic reset",
              "n=48, Marseille (NCT06540651); ends Feb 2027",
            ]}
          />
          <TreatmentCard
            title="💉 Botulinum Toxin A (SPG)"
            badge="Phase 3"
            badgeVariant="amber"
            accent="primary"
            items={[
              "SPG blockade with BoNT-A for refractory chronic CH",
              "5 European sites; 112 patients (NCT03944876)",
              "Norwegian University of Science & Technology",
              "Primary completion Sep 2025",
            ]}
          />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Ban className="size-4 text-destructive" />{t("treatments.prescribingFailures")}</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          These are frequently prescribed to CH patients by non-specialist doctors but are ineffective or harmful. If you're receiving any of these as your primary CH treatment, seek a headache specialist.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TreatmentCard
            title="Oral Triptans"
            badge="Ineffective"
            badgeVariant="danger"
            accent="destructive"
            items={[
              "Oral sumatriptan/rizatriptan onset is 30–60 min — far too slow for CH attacks lasting 15–180 min",
              "Only subcutaneous injection (onset ~10 min) or nasal spray works for CH",
              "Commonly prescribed by GPs unfamiliar with CH — ask for SC sumatriptan",
            ]}
          />
          <TreatmentCard
            title="Opioids / Painkillers"
            badge="Don't work"
            badgeVariant="danger"
            accent="destructive"
            items={[
              "Opioids do not abort CH attacks — the attack typically ends before they take effect",
              "Create dependency with no therapeutic benefit for CH",
              "Often prescribed in emergency rooms by doctors unfamiliar with the condition",
            ]}
          />
          <TreatmentCard
            title="Standard Migraine Preventives"
            badge="Wrong condition"
            badgeVariant="danger"
            accent="destructive"
            items={[
              "Topiramate, amitriptyline, propranolol — effective for migraine but not for CH",
              "Frequently prescribed due to misdiagnosis as migraine",
              "Months wasted on ineffective treatment while attacks continue",
            ]}
          />
          <TreatmentCard
            title="SSRIs / SNRIs"
            badge="Caution"
            badgeVariant="danger"
            accent="destructive"
            items={[
              "May increase attack frequency in some CH patients",
              "Block serotonin receptors needed for psychedelic treatments (busting)",
              "Require 2–5 week washout before busting can be attempted",
              "Discuss alternatives with your doctor if considering other treatment paths",
            ]}
          />
        </div>
      </div>
    </div>
  )
}

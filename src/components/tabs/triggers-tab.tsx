import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const TRIGGERS = [
  { name: "Alcohol (any type)", notes: "Even a small amount reliably triggers attacks during an active bout. The community universally avoids all alcohol during cycles.", severity: "High", sevClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  { name: "Altitude / Low oxygen", notes: "Flights, mountains, high altitude environments. Some patients pre-treat with supplemental O₂ before flying. Directly relevant to CH's O₂ mechanism.", severity: "High", sevClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  { name: "Strong chemical smells", notes: "Gasoline, paint fumes, perfume, cleaning products, solvents. Wear a mask if exposure is unavoidable. Common workplace trigger.", severity: "High", sevClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  { name: "Sleep disruption", notes: "CH attacks frequently occur during or around REM sleep transitions. Jet lag, shift work, naps, or any disruption to sleep schedule reliably worsen cycles for many.", severity: "High", sevClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  { name: "Vasodilating drugs", notes: "Nitrates (GTN sprays), sildenafil/tadalafil, some blood pressure medications. Always inform prescribers about CH diagnosis.", severity: "High", sevClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  { name: "Histamine-rich foods", notes: "Aged cheeses, cured/processed meats, fermented foods. Not universal but frequently reported, especially during active cycles. (Red wine is a double trigger — both histamine and alcohol/vasodilation.)", severity: "Medium", sevClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  { name: "Heat exposure", notes: "Hot baths, saunas, intense exercise in heat. Triggers for some; others find hot showers offer temporary relief during an attack. Individual variation.", severity: "Medium", sevClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  { name: "Bright / flickering light", notes: "Less consistent than migraine triggers but reported by a subset of patients, especially during attacks.", severity: "Low-Medium", sevClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  { name: "Season changes", notes: "Many episodic CH patients have predictable seasonal patterns (spring, autumn). Not avoidable, but useful to anticipate and start preventives early.", severity: "Predictive", sevClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  { name: "Stress / relaxation after stress", notes: "\"Let-down\" headache — attacks often occur after stress resolves (weekends, vacations). Classic pattern in episodic patients.", severity: "Variable", sevClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
]

export function TriggersTab() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold">Triggers &amp; Avoidance</h2>
        <p className="mt-1 text-sm text-muted-foreground">Community-identified triggers — especially relevant during active cluster cycles</p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trigger</TableHead>
              <TableHead>Community Notes</TableHead>
              <TableHead className="w-[100px]">Severity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TRIGGERS.map((t) => (
              <TableRow key={t.name}>
                <TableCell className="font-semibold">{t.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.notes}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={t.sevClass}>{t.severity}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="text-sm">✅ During an Active Cycle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
            <ul className="flex flex-col gap-1.5">
              <li>• Zero alcohol — even one drink can trigger an attack within 30–60 minutes</li>
              <li>• Maintain strict sleep schedule; protect sleep timing</li>
              <li>• Carry O₂ or sumatriptan injection at all times</li>
              <li>• Inform airline staff / travel with O₂ documentation</li>
            </ul>
            <ul className="flex flex-col gap-1.5">
              <li>• Avoid scented products and chemical environments</li>
              <li>• Pre-treat with O₂ before known trigger exposure where possible</li>
              <li>• Keep a headache diary to identify personal triggers</li>
              <li>• Alert family/colleagues — attacks are very visible and frightening</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

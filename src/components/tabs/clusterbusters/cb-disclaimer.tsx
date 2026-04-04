import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface CbDisclaimerProps {
  onNavigate: (path: string) => void
}

export function CbDisclaimer({ onNavigate }: CbDisclaimerProps) {
  return (
    <Alert variant="warning">
      <AlertTriangle className="size-4" />
      <AlertDescription>
        <strong>Community-reported data, not medical advice.</strong> This analysis is based on self-reported
        forum posts and does not constitute clinical evidence. Always consult a headache specialist before
        making treatment decisions.{" "}
        <button
          className="underline underline-offset-2 hover:text-foreground"
          onClick={() => onNavigate("methodology")}
        >
          Read our methodology
        </button>
      </AlertDescription>
    </Alert>
  )
}

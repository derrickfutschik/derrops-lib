import { Button } from '@/components/ui/button'
import { SpecUploadCard } from './SpecUploadCard'

interface SpecUploadStepProps {
  apiId: string
  specContent?: string | null
  onSkip: () => void
  onViewApi: () => void
}

export function SpecUploadStep({ apiId, specContent, onSkip, onViewApi }: SpecUploadStepProps) {
  return (
    <div className="space-y-6">
      <SpecUploadCard
        apiId={apiId}
        title="Upload initial spec"
        initialContent={specContent ?? undefined}
      />
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onSkip}>Skip for now</Button>
        <Button onClick={onViewApi}>View API</Button>
      </div>
    </div>
  )
}

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAegisInstances, useCreateAegis, useCreateConnection } from '@/hooks/useConnectionsApi'
import type { CreateConnectionResponse } from '@/hooks/useConnectionsApi'
import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { WizardAegis, type AegisMode, type NewAegisForm } from './WizardAegis'
import { WizardConnectivity, type ConnectivityMode } from './WizardConnectivity'
import { WizardHttpSettings } from './WizardHttpSettings'
import { WizardRelayDetails, type RelayType } from './WizardRelayDetails'
import { WizardSqsSettings, type SqsOwnership } from './WizardSqsSettings'
import { WizardSuccess } from './WizardSuccess'

type Step = 'connectivity' | 'http' | 'sqs' | 'details' | 'aegis' | 'review' | 'success'

function stepsFor(connectivity: ConnectivityMode | null): Step[] {
  const base: Step[] = ['connectivity']
  if (connectivity === 'direct-http') base.push('http')
  if (connectivity === 'sqs') base.push('sqs')
  if (connectivity === 'sqs-http') { base.push('http'); base.push('sqs') }
  base.push('details', 'aegis', 'review', 'success')
  return base
}

const STEP_TITLES: Record<Step, string> = {
  connectivity: 'Choose Connectivity',
  http: 'HTTP Settings',
  sqs: 'SQS Settings',
  details: 'Relay Details',
  aegis: 'Aegis (Optional)',
  review: 'Review & Create',
  success: 'Connection Created',
}

interface CreateConnectionWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateConnectionWizard({ open, onOpenChange }: CreateConnectionWizardProps) {
  const { toast } = useToast()
  const { data: aegisInstances = [] } = useAegisInstances()
  const createConnection = useCreateConnection()
  const createAegis = useCreateAegis()

  // Form state
  const [connectivity, setConnectivity] = useState<ConnectivityMode | null>(null)
  const [url, setUrl] = useState('')
  const [sqsOwnership, setSqsOwnership] = useState<SqsOwnership>('slaops')
  const [customQueueUrl, setCustomQueueUrl] = useState('')
  const [customRegion, setCustomRegion] = useState('')
  const [name, setName] = useState('')
  const [relayType, setRelayType] = useState<RelayType>('self-hosted')
  const [aegisMode, setAegisMode] = useState<AegisMode>('skip')
  const [selectedAegisId, setSelectedAegisId] = useState<string | null>(null)
  const [newAegisForm, setNewAegisForm] = useState<NewAegisForm>({ name: '', url: '', jwksUrl: '' })
  const [result, setResult] = useState<CreateConnectionResponse | null>(null)

  const steps = stepsFor(connectivity)
  const [stepIdx, setStepIdx] = useState(0)
  const currentStep = steps[stepIdx]

  const localWithHttp = relayType === 'local-dev' && connectivity === 'direct-http'

  const canAdvance = (): boolean => {
    if (currentStep === 'connectivity') return connectivity !== null
    if (currentStep === 'http') return url.trim().length > 0
    if (currentStep === 'sqs') return sqsOwnership === 'slaops' || (customQueueUrl.trim().endsWith('.fifo') && customRegion.trim().length > 0)
    if (currentStep === 'details') return name.trim().length > 0 && !localWithHttp
    if (currentStep === 'aegis') {
      if (aegisMode === 'existing') return selectedAegisId !== null
      if (aegisMode === 'new') return newAegisForm.name.trim().length > 0 && newAegisForm.url.trim().length > 0 && newAegisForm.jwksUrl.trim().length > 0
      return true
    }
    return true
  }

  const handleNext = () => setStepIdx(i => Math.min(i + 1, steps.length - 1))
  const handleBack = () => setStepIdx(i => Math.max(i - 1, 0))

  const handleCreate = async () => {
    try {
      // If registering a new Aegis inline, create it first
      let aegisId: string | undefined
      if (aegisMode === 'new') {
        const aegisResult = await createAegis.mutateAsync({
          name: newAegisForm.name,
          url: newAegisForm.url,
          jwksUrl: newAegisForm.jwksUrl,
        })
        aegisId = aegisResult.id
      } else if (aegisMode === 'existing') {
        aegisId = selectedAegisId ?? undefined
      }

      const deliveryMode =
        connectivity === 'direct-http' ? 'direct' :
        connectivity === 'sqs' ? 'platform-queue' : 'hybrid'

      const created = await createConnection.mutateAsync({
        name,
        type: relayType === 'local-dev' ? 'local-dev' : relayType === 'managed' ? 'managed' : 'self-hosted',
        delivery_mode: deliveryMode,
        url: url || undefined,
        sqs_queue_mode: deliveryMode !== 'direct'
          ? (sqsOwnership === 'slaops' ? 'platform' : 'relay')
          : undefined,
        relay_sqs_queue_url: sqsOwnership === 'custom' ? customQueueUrl : undefined,
        aegis_id: aegisId,
      })

      setResult(created)
      setStepIdx(steps.indexOf('success'))
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create connection',
        variant: 'destructive',
      })
    }
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      // Reset state
      setConnectivity(null)
      setUrl('')
      setSqsOwnership('slaops')
      setCustomQueueUrl('')
      setCustomRegion('')
      setName('')
      setRelayType('self-hosted')
      setAegisMode('skip')
      setSelectedAegisId(null)
      setNewAegisForm({ name: '', url: '', jwksUrl: '' })
      setResult(null)
      setStepIdx(0)
    }
    onOpenChange(open)
  }

  const nonSuccessSteps = steps.filter(s => s !== 'success')
  const progressIdx = nonSuccessSteps.indexOf(currentStep)
  const isReview = currentStep === 'review'
  const isSuccess = currentStep === 'success'
  const isCreating = createConnection.isPending || createAegis.isPending

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{STEP_TITLES[currentStep]}</DialogTitle>
          {!isSuccess && (
            <div className="flex gap-1 mt-2">
              {nonSuccessSteps.map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= progressIdx ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="py-2">
          {currentStep === 'connectivity' && (
            <WizardConnectivity value={connectivity} onChange={setConnectivity} />
          )}
          {currentStep === 'http' && (
            <WizardHttpSettings url={url} onChange={setUrl} />
          )}
          {currentStep === 'sqs' && (
            <WizardSqsSettings
              ownership={sqsOwnership}
              onOwnershipChange={setSqsOwnership}
              customQueueUrl={customQueueUrl}
              onCustomQueueUrlChange={setCustomQueueUrl}
              customRegion={customRegion}
              onCustomRegionChange={setCustomRegion}
            />
          )}
          {currentStep === 'details' && (
            <WizardRelayDetails
              name={name}
              onNameChange={setName}
              relayType={relayType}
              onRelayTypeChange={setRelayType}
              connectivity={connectivity}
            />
          )}
          {currentStep === 'aegis' && (
            <WizardAegis
              mode={aegisMode}
              onModeChange={setAegisMode}
              existingInstances={aegisInstances}
              selectedAegisId={selectedAegisId}
              onSelectedAegisIdChange={setSelectedAegisId}
              newForm={newAegisForm}
              onNewFormChange={setNewAegisForm}
            />
          )}
          {currentStep === 'review' && (
            <div className="space-y-3 text-sm">
              {[
                ['Connection name', name],
                ['Connectivity', connectivity === 'direct-http' ? 'Direct HTTP' : connectivity === 'sqs' ? 'SQS' : 'SQS + HTTP'],
                url ? ['Relay URL', url] : null,
                connectivity !== 'direct-http' ? ['SQS queue', sqsOwnership === 'slaops' ? 'SLAOps-managed' : customQueueUrl] : null,
                ['Relay type', relayType],
                ['Aegis', aegisMode === 'skip' ? 'None' : aegisMode === 'new' ? `New: ${newAegisForm.name}` : aegisInstances.find(a => a.id === selectedAegisId)?.name ?? 'None'],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-4 py-2 border-b last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right">{value}</span>
                </div>
              ))}
            </div>
          )}
          {currentStep === 'success' && result && (
            <WizardSuccess result={result} onClose={() => handleClose(false)} />
          )}
        </div>

        {!isSuccess && (
          <div className="flex justify-between pt-2 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={stepIdx === 0}
            >
              Back
            </Button>
            {isReview ? (
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? 'Creating…' : 'Create Connection'}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canAdvance()}>
                Next
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

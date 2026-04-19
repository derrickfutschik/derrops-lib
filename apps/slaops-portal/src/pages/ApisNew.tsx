import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowLeft, Search, PlusCircle } from 'lucide-react'
import { VersionFetchStateStrategyEnum } from '@/client/slaops-cloud'
import { useCreateApi, useAdoptApi } from '@/hooks/useApisApi'
import { useUploadUrl, useIndexSpec } from '@/hooks/useIndexerApi'
import { WizardCatalogueSearch } from '@/components/apis/WizardCatalogueSearch'
import { SpecUploadCard } from '@/components/apis/SpecUploadCard'
import { useToast } from '@/components/ui/use-toast'
import type { CatalogueHit } from '@/types/indexer'

const privateSchema = z.object({
  name: z.string().min(1, 'Required').max(255),
  description: z.string().optional(),
  externalUrl: z.string().url().optional().or(z.literal('')),
  versionStrategy: z.enum(['manual', 'url_fetch']),
  fetchUrl: z.string().optional(),
  fetchCron: z.string().optional(),
})

type PrivateFormValues = z.infer<typeof privateSchema>

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
            i + 1 === step
              ? 'bg-primary text-primary-foreground'
              : i + 1 < step
              ? 'bg-primary/30 text-primary'
              : 'bg-muted text-muted-foreground'
          }`}>
            {i + 1}
          </div>
          {i < total - 1 && <div className="h-px w-8 bg-border" />}
        </div>
      ))}
    </div>
  )
}

const ApisNew = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const createApi = useCreateApi()
  const adoptApi = useAdoptApi()

  const [step, setStep] = useState(1)
  const [path, setPath] = useState<'catalogue' | 'private' | null>(null)
  const [selectedHit, setSelectedHit] = useState<CatalogueHit | null>(null)
  const [createdApiId, setCreatedApiId] = useState<string | null>(null)

  const form = useForm<PrivateFormValues>({
    resolver: zodResolver(privateSchema),
    defaultValues: { name: '', description: '', externalUrl: '', versionStrategy: 'manual', fetchUrl: '', fetchCron: '' },
  })
  const strategy = form.watch('versionStrategy')

  const handleSelectCatalogueHit = (hit: CatalogueHit) => {
    setSelectedHit(hit)
    setPath('catalogue')
    setStep(2)
  }

  const handleAdopt = async () => {
    if (!selectedHit) return
    try {
      const api = await adoptApi.mutateAsync({ globalOpensearchId: selectedHit.id })
      navigate(`/apis/${api.id}`)
    } catch (error: unknown) {
      toast({
        title: 'Adoption failed',
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'destructive',
      })
    }
  }

  const handlePrivateSubmit = async (values: PrivateFormValues) => {
    try {
      const api = await createApi.mutateAsync({
        name: values.name,
        description: values.description || undefined,
        externalUrl: values.externalUrl || undefined,
        versionStrategy: values.versionStrategy,
        fetchUrl: values.fetchUrl || undefined,
        fetchCron: values.fetchCron || undefined,
      })
      if (values.versionStrategy === VersionFetchStateStrategyEnum.UrlFetch) {
        navigate(`/apis/${api.id}`)
      } else {
        setCreatedApiId(api.id)
        setStep(3)
      }
    } catch (error: unknown) {
      toast({
        title: 'Creation failed',
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'destructive',
      })
    }
  }

  const totalSteps = path === 'catalogue' ? 2 : 3

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/30 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/apis')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              APIs
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-2">New API</h1>
        <StepIndicator step={step} total={totalSteps} />

        {/* Step 1 */}
        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <Search className="h-5 w-5 text-primary mb-1" />
                <CardTitle className="text-base">Search platform catalogue</CardTitle>
                <CardDescription className="text-xs">Use a SLAOps-managed spec. Always up to date automatically.</CardDescription>
              </CardHeader>
              <CardContent>
                <WizardCatalogueSearch onSelect={handleSelectCatalogueHit} />
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <PlusCircle className="h-5 w-5 text-primary mb-1" />
                <CardTitle className="text-base">Register my own API</CardTitle>
                <CardDescription className="text-xs">Upload your own OpenAPI spec and manage it yourself.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex items-end">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => { setPath('private'); setStep(2) }}
                >
                  Register my own
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2A — Adopt platform API */}
        {step === 2 && path === 'catalogue' && selectedHit && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{selectedHit.title}</CardTitle>
                {selectedHit.description && (
                  <CardDescription>{selectedHit.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  {selectedHit.operationCount != null && (
                    <Badge variant="secondary">{selectedHit.operationCount} operations</Badge>
                  )}
                  {selectedHit.serverCount != null && (
                    <Badge variant="secondary">{selectedHit.serverCount} servers</Badge>
                  )}
                  {selectedHit.version && (
                    <Badge variant="outline" className="font-mono">{selectedHit.version}</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  This API is managed by SLAOps. You'll always have the latest version automatically.
                </p>
              </CardContent>
            </Card>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setStep(1); setSelectedHit(null) }}>Back</Button>
              <Button onClick={handleAdopt} disabled={adoptApi.isPending}>
                {adoptApi.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Adopt API
              </Button>
            </div>
          </div>
        )}

        {/* Step 2B — Private API details */}
        {step === 2 && path === 'private' && (
          <form onSubmit={form.handleSubmit(handlePrivateSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...form.register('description')} rows={3} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="externalUrl">External URL</Label>
              <Input id="externalUrl" type="url" placeholder="https://..." {...form.register('externalUrl')} />
            </div>

            <div className="space-y-2">
              <Label>Version strategy</Label>
              <RadioGroup
                value={strategy}
                onValueChange={(v) => form.setValue('versionStrategy', v as 'manual' | 'url_fetch')}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={VersionFetchStateStrategyEnum.Manual} id="s-manual" />
                  <Label htmlFor="s-manual" className="cursor-pointer">Manual upload</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={VersionFetchStateStrategyEnum.UrlFetch} id="s-url-fetch" />
                  <Label htmlFor="s-url-fetch" className="cursor-pointer">Scheduled URL fetch</Label>
                </div>
              </RadioGroup>
            </div>

            {strategy === VersionFetchStateStrategyEnum.UrlFetch && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fetchUrl">Fetch URL *</Label>
                  <Input id="fetchUrl" type="url" placeholder="https://..." {...form.register('fetchUrl')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fetchCron">Fetch schedule (cron)</Label>
                  <Input id="fetchCron" placeholder="0 2 * * *" {...form.register('fetchCron')} />
                  <p className="text-xs text-muted-foreground">Default: daily at 02:00 UTC</p>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button type="submit" disabled={createApi.isPending}>
                {createApi.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Next
              </Button>
            </div>
          </form>
        )}

        {/* Step 3 — Upload initial spec */}
        {step === 3 && createdApiId && (
          <div className="space-y-6">
            <SpecUploadCard apiId={createdApiId} title="Upload initial spec" />
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => navigate(`/apis/${createdApiId}`)}>
                Skip for now
              </Button>
              <Button onClick={() => navigate(`/apis/${createdApiId}`)}>View API</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default ApisNew

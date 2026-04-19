import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { VersionFetchStateStrategyEnum } from '@/client/slaops-cloud'
import { useCreateApi, useAdoptApi } from '@/hooks/useApisApi'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  setStep,
  setPath,
  setSelectedCatalogueHit,
  setCreatedApiId,
  resetWizard,
  selectWizardStep,
  selectWizardPath,
  selectSelectedCatalogueHit,
  selectCreatedApiId,
  selectSpecContent,
} from '@/store/newApiWizardSlice'
import { useToast } from '@/components/ui/use-toast'
import { PathSelector } from '@/components/apis/PathSelector'
import { CatalogueAdoptStep } from '@/components/apis/CatalogueAdoptStep'
import { PrivateRegistrationForm } from '@/components/apis/PrivateRegistrationForm'
import { SpecUploadStep } from '@/components/apis/SpecUploadStep'
import type { CatalogueHit } from '@/types/indexer'
import type { PrivateFormValues } from '@/components/apis/PrivateRegistrationForm'

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
              i + 1 === step
                ? 'bg-primary text-primary-foreground'
                : i + 1 < step
                  ? 'bg-primary/30 text-primary'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
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
  const dispatch = useAppDispatch()

  const step = useAppSelector(selectWizardStep)
  const path = useAppSelector(selectWizardPath)
  const selectedHit = useAppSelector(selectSelectedCatalogueHit)
  const createdApiId = useAppSelector(selectCreatedApiId)
  const specContent = useAppSelector(selectSpecContent)

  const createApi = useCreateApi()
  const adoptApi = useAdoptApi()

  useEffect(() => {
    return () => {
      dispatch(resetWizard())
    }
  }, [dispatch])

  const handleSelectCatalogueHit = (hit: CatalogueHit) => {
    dispatch(setSelectedCatalogueHit(hit))
    dispatch(setPath('catalogue'))
    dispatch(setStep(2))
  }

  const handleRegisterOwn = () => {
    dispatch(setPath('private'))
    dispatch(setStep(2))
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
        dispatch(setCreatedApiId(api.id))
        dispatch(setStep(3))
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

        {step === 1 && (
          <PathSelector
            onSelectCatalogueHit={handleSelectCatalogueHit}
            onRegisterOwn={handleRegisterOwn}
          />
        )}

        {step === 2 && path === 'catalogue' && selectedHit && (
          <CatalogueAdoptStep
            hit={selectedHit}
            isPending={adoptApi.isPending}
            onAdopt={handleAdopt}
            onBack={() => {
              dispatch(setSelectedCatalogueHit(null))
              dispatch(setStep(1))
            }}
          />
        )}

        {step === 2 && path === 'private' && (
          <PrivateRegistrationForm
            isPending={createApi.isPending}
            onSubmit={handlePrivateSubmit}
            onBack={() => dispatch(setStep(1))}
          />
        )}

        {step === 3 && createdApiId && (
          <SpecUploadStep
            apiId={createdApiId}
            specContent={specContent}
            onSkip={() => navigate(`/apis/${createdApiId}`)}
            onViewApi={() => navigate(`/apis/${createdApiId}`)}
          />
        )}
      </main>
    </div>
  )
}

export default ApisNew

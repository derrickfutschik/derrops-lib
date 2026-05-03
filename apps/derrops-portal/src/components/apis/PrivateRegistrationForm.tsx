import { VersionFetchStateStrategyEnum } from '@/client/derrops-cloud'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { useApiInfo } from '@/hooks/useApiInfo'
import { useDebounce } from '@/hooks/useDebounce'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  selectInfoFetchResult,
  selectLastAutoPopulated,
  setLastAutoPopulated,
} from '@/store/newApiWizardSlice'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { InfoFetchFeedback } from './InfoFetchFeedback'

const schema = z.object({
  name: z.string().min(1, 'Required').max(255),
  description: z.string().optional(),
  externalUrl: z.string().url().optional().or(z.literal('')),
  versionStrategy: z.enum(['manual', 'url_fetch']),
  fetchUrl: z.string().optional(),
  fetchCron: z.string().optional(),
})

export type PrivateFormValues = z.infer<typeof schema>

export interface PrivateRegistrationFormProps {
  isPending: boolean
  onSubmit: (values: PrivateFormValues) => Promise<void>
  onBack: () => void
}

export function PrivateRegistrationForm({
  isPending,
  onSubmit,
  onBack,
}: PrivateRegistrationFormProps) {
  const dispatch = useAppDispatch()
  const infoResult = useAppSelector(selectInfoFetchResult)
  const lastAutoPopulated = useAppSelector(selectLastAutoPopulated)

  const form = useForm<PrivateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      externalUrl: '',
      versionStrategy: 'manual',
      fetchUrl: '',
      fetchCron: '',
    },
  })

  const strategy = form.watch('versionStrategy')
  const rawUrl = form.watch('externalUrl')
  const debouncedUrl = useDebounce(rawUrl, 500)
  const { fetchInfo, clearInfo } = useApiInfo()

  useEffect(() => {
    if (!debouncedUrl) {
      clearInfo()
      return
    }
    try {
      new URL(debouncedUrl)
      fetchInfo(debouncedUrl)
    } catch {
      clearInfo()
    }
  }, [debouncedUrl, fetchInfo, clearInfo])

  useEffect(() => {
    if (!infoResult) return

    const currentName = form.getValues('name')
    const currentDesc = form.getValues('description') ?? ''

    if (!currentName || currentName === lastAutoPopulated.name) {
      form.setValue('name', infoResult.title, { shouldValidate: true })
    }
    if ((!currentDesc || currentDesc === lastAutoPopulated.description) && infoResult.description) {
      form.setValue('description', infoResult.description, { shouldValidate: true })
    }

    dispatch(
      setLastAutoPopulated({
        name: infoResult.title,
        description: infoResult.description ?? null,
      }),
    )
  }, [infoResult]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="externalUrl">External URL</Label>
        <Input
          id="externalUrl"
          type="url"
          placeholder="https://..."
          {...form.register('externalUrl')}
        />
        <InfoFetchFeedback />
      </div>

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

      <div className="space-y-2">
        <Label>Version strategy</Label>
        <RadioGroup
          value={strategy}
          onValueChange={(v) => form.setValue('versionStrategy', v as 'manual' | 'url_fetch')}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value={VersionFetchStateStrategyEnum.Manual} id="s-manual" />
            <Label htmlFor="s-manual" className="cursor-pointer">
              Manual upload
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value={VersionFetchStateStrategyEnum.UrlFetch} id="s-url-fetch" />
            <Label htmlFor="s-url-fetch" className="cursor-pointer">
              Scheduled URL fetch
            </Label>
          </div>
        </RadioGroup>
      </div>

      {strategy === VersionFetchStateStrategyEnum.UrlFetch && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="fetchUrl">Fetch URL *</Label>
            <Input
              id="fetchUrl"
              type="url"
              placeholder="https://..."
              {...form.register('fetchUrl')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fetchCron">Fetch schedule (cron)</Label>
            <Input id="fetchCron" placeholder="0 2 * * *" {...form.register('fetchCron')} />
            <p className="text-xs text-muted-foreground">Default: daily at 02:00 UTC</p>
          </div>
        </>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Next
        </Button>
      </div>
    </form>
  )
}

import type { ApiEntity, UpdateApiDto } from '@/client/derrops-cloud'
import { ApiEntityManagementModeEnum, VersionFetchStateStrategyEnum } from '@/client/derrops-cloud'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { useUpdateApi } from '@/hooks/useApisApi'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  externalUrl: z.string().url().optional().or(z.literal('')),
  versionStrategy: z.enum(['manual', 'url_fetch']),
  fetchUrl: z.string().url().optional().or(z.literal('')),
  fetchCron: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface EditApiDrawerProps {
  api: ApiEntity | null
  open: boolean
  onClose: () => void
}

export function EditApiDrawer({ api, open, onClose }: EditApiDrawerProps) {
  const { toast } = useToast()
  const updateMutation = useUpdateApi()

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
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

  useEffect(() => {
    if (api) {
      reset({
        name: api.name,
        description: api.description ?? '',
        externalUrl: api.externalUrl ?? '',
        versionStrategy: (api.fetch?.strategy as 'manual' | 'url_fetch') ?? 'manual',
        fetchUrl: api.fetch?.url ?? '',
        fetchCron: api.fetch?.cron ?? '',
      })
    }
  }, [api, reset])

  const strategy = watch('versionStrategy')
  const isPrivate = api?.managementMode !== ApiEntityManagementModeEnum.Platform

  const onSubmit = async (values: FormValues) => {
    if (!api) return
    const dto: UpdateApiDto = {
      name: values.name,
      description: values.description || undefined,
      externalUrl: values.externalUrl || undefined,
      versionStrategy: values.versionStrategy,
      fetchUrl: values.fetchUrl || undefined,
      fetchCron: values.fetchCron || undefined,
    }
    try {
      await updateMutation.mutateAsync({ id: api.id, dto })
      toast({ title: 'API updated' })
      onClose()
    } catch (error: unknown) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'destructive',
      })
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit API</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register('description')} rows={3} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="externalUrl">External URL</Label>
            <Input
              id="externalUrl"
              type="url"
              placeholder="https://..."
              {...register('externalUrl')}
            />
            {errors.externalUrl && (
              <p className="text-xs text-destructive">{errors.externalUrl.message}</p>
            )}
          </div>

          {isPrivate && (
            <div className="space-y-2">
              <Label>Version strategy</Label>
              <RadioGroup
                defaultValue={strategy}
                onValueChange={(v) =>
                  reset({ ...watch(), versionStrategy: v as 'manual' | 'url_fetch' })
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={VersionFetchStateStrategyEnum.Manual} id="edit-manual" />
                  <Label htmlFor="edit-manual" className="cursor-pointer">
                    Manual upload
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={VersionFetchStateStrategyEnum.UrlFetch}
                    id="edit-url-fetch"
                  />
                  <Label htmlFor="edit-url-fetch" className="cursor-pointer">
                    Scheduled URL fetch
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {isPrivate && strategy === VersionFetchStateStrategyEnum.UrlFetch && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="fetchUrl">Fetch URL *</Label>
                <Input
                  id="fetchUrl"
                  type="url"
                  placeholder="https://..."
                  {...register('fetchUrl')}
                />
                {errors.fetchUrl && (
                  <p className="text-xs text-destructive">{errors.fetchUrl.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fetchCron">Fetch schedule (cron)</Label>
                <Input id="fetchCron" placeholder="0 2 * * *" {...register('fetchCron')} />
                <p className="text-xs text-muted-foreground">Default: daily at 02:00 UTC</p>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUploadUrl, useIndexSpec } from '@/hooks/useIndexerApi'
import { useToast } from '@/components/ui/use-toast'
import { IndexingResultPanel } from './IndexingResultPanel'
import { SpecUploadFileTab } from './SpecUploadFileTab'
import { SpecUploadPasteTab } from './SpecUploadPasteTab'
import { SpecUploadUrlTab } from './SpecUploadUrlTab'
import type { IndexingResponse } from '@/types/indexer'
import { useQueryClient } from '@tanstack/react-query'

interface SpecUploadCardProps {
  apiId: string
  title?: string
  initialUrl?: string
  initialContent?: string
}

export function SpecUploadCard({ apiId, title = 'Upload Spec', initialUrl, initialContent }: SpecUploadCardProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const getUploadUrl = useUploadUrl()
  const indexSpec = useIndexSpec()

  const [result, setResult] = useState<IndexingResponse | null>(null)

  const isPending = getUploadUrl.isPending || indexSpec.isPending

  const handleUploadAndIndex = async (content: string, filename: string) => {
    try {
      const ext = filename.endsWith('.json') ? 'json' : 'yaml'
      const key = `upload/${apiId}/${Date.now()}.${ext}`

      const presigned = await getUploadUrl.mutateAsync({ apiId, key })

      await fetch(presigned.url, {
        method: 'PUT',
        body: content,
        headers: { 'Content-Type': ext === 'json' ? 'application/json' : 'application/x-yaml' },
      })

      const indexResult = await indexSpec.mutateAsync({
        apiId,
        bucket: presigned.bucket,
        key: presigned.key,
      })

      setResult(indexResult)
      queryClient.invalidateQueries({ queryKey: ['apis', apiId] })
      queryClient.invalidateQueries({ queryKey: ['apis'] })
    } catch (error: unknown) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'destructive',
      })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue={initialUrl ? 'url' : initialContent ? 'paste' : 'upload'}>
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="upload">Upload file</TabsTrigger>
            <TabsTrigger value="paste">Paste content</TabsTrigger>
            <TabsTrigger value="url">URL</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-3">
            <SpecUploadFileTab isPending={isPending} onSubmit={handleUploadAndIndex} />
          </TabsContent>

          <TabsContent value="paste" className="mt-3">
            <SpecUploadPasteTab
              isPending={isPending}
              initialContent={initialContent}
              onSubmit={handleUploadAndIndex}
            />
          </TabsContent>

          <TabsContent value="url" className="mt-3">
            <SpecUploadUrlTab
              isPending={isPending}
              initialUrl={initialUrl}
              initialContent={initialContent}
              onSubmit={handleUploadAndIndex}
            />
          </TabsContent>
        </Tabs>

        {result && <IndexingResultPanel result={result} />}
      </CardContent>
    </Card>
  )
}

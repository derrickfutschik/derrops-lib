import { useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Upload } from 'lucide-react'
import { useUploadUrl, useIndexSpec } from '@/hooks/useIndexerApi'
import { useToast } from '@/components/ui/use-toast'
import { IndexingResultPanel } from './IndexingResultPanel'
import type { IndexingResponse } from '@/types/indexer'
import { useQueryClient } from '@tanstack/react-query'

interface SpecUploadCardProps {
  apiId: string
  title?: string
  initialContent?: string
}

export function SpecUploadCard({ apiId, title = 'Upload Spec', initialContent }: SpecUploadCardProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const getUploadUrl = useUploadUrl()
  const indexSpec = useIndexSpec()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [pasteContent, setPasteContent] = useState(initialContent ?? '')
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult] = useState<IndexingResponse | null>(null)

  const handleFile = useCallback((file: File) => {
    setSelectedFile(file)
    setResult(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

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

  const handleFileSubmit = async () => {
    if (!selectedFile) return
    const text = await selectedFile.text()
    await handleUploadAndIndex(text, selectedFile.name)
  }

  const handlePasteSubmit = async () => {
    if (!pasteContent.trim()) return
    await handleUploadAndIndex(pasteContent, 'spec.yaml')
  }

  const isPending = getUploadUrl.isPending || indexSpec.isPending

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue={initialContent ? 'paste' : 'upload'}>
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="upload">Upload file</TabsTrigger>
            <TabsTrigger value="paste">Paste content</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-3">
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              {selectedFile ? (
                <div className="text-sm">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <p>Drop a .yaml, .yml, or .json file here</p>
                  <p className="text-xs mt-1">or click to browse</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".yaml,.yml,.json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <Button
              className="w-full mt-3"
              onClick={handleFileSubmit}
              disabled={!selectedFile || isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload and Index
            </Button>
          </TabsContent>

          <TabsContent value="paste" className="mt-3 space-y-3">
            <Textarea
              placeholder="Paste your OpenAPI YAML or JSON here"
              className="font-mono text-xs min-h-[160px]"
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={handlePasteSubmit}
              disabled={!pasteContent.trim() || isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Index
            </Button>
          </TabsContent>
        </Tabs>

        {result && <IndexingResultPanel result={result} />}
      </CardContent>
    </Card>
  )
}

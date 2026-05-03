import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

interface SpecUploadPasteTabProps {
  isPending: boolean
  initialContent?: string
  onSubmit: (content: string, filename: string) => Promise<void>
}

export function SpecUploadPasteTab({
  isPending,
  initialContent,
  onSubmit,
}: SpecUploadPasteTabProps) {
  const [pasteContent, setPasteContent] = useState(initialContent ?? '')

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="Paste your OpenAPI YAML or JSON here"
        className="font-mono text-xs min-h-[160px]"
        value={pasteContent}
        onChange={(e) => setPasteContent(e.target.value)}
      />
      <Button
        className="w-full"
        onClick={() => onSubmit(pasteContent, 'spec.yaml')}
        disabled={!pasteContent.trim() || isPending}
      >
        {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Index
      </Button>
    </div>
  )
}

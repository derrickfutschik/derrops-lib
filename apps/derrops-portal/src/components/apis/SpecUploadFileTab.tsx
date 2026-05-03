import { Button } from '@/components/ui/button'
import { Loader2, Upload } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

interface SpecUploadFileTabProps {
  isPending: boolean
  onSubmit: (content: string, filename: string) => Promise<void>
}

export function SpecUploadFileTab({ isPending, onSubmit }: SpecUploadFileTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = useCallback((file: File) => {
    setSelectedFile(file)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleSubmit = async () => {
    if (!selectedFile) return
    const text = await selectedFile.text()
    await onSubmit(text, selectedFile.name)
  }

  return (
    <>
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
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
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />
      <Button className="w-full mt-3" onClick={handleSubmit} disabled={!selectedFile || isPending}>
        {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Upload and Index
      </Button>
    </>
  )
}

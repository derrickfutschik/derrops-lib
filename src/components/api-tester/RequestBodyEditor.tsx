import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlignLeft, Maximize2, Minimize2, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

type BodyType = 'none' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary'
type RawType = 'json' | 'xml' | 'text'

interface FormDataEntry {
  key: string
  value: string
  enabled: boolean
}

interface RequestBodyEditorProps {
  value: string
  onChange: (value: string) => void
  bodyType: BodyType
  onBodyTypeChange: (type: BodyType) => void
  rawType: RawType
  onRawTypeChange: (type: RawType) => void
  formData: FormDataEntry[]
  onFormDataChange: (data: FormDataEntry[]) => void
}

interface JsonError {
  line: number
  column: number
  message: string
}

function parseJsonError(content: string): JsonError | null {
  if (!content.trim()) return null

  try {
    JSON.parse(content)
    return null
  } catch (e) {
    if (e instanceof SyntaxError) {
      // Try to extract position from error message
      const posMatch = e.message.match(/position\s+(\d+)/i)
      if (posMatch) {
        const position = parseInt(posMatch[1], 10)
        const lines = content.substring(0, position).split('\n')
        return {
          line: lines.length - 1,
          column: lines[lines.length - 1].length,
          message: e.message,
        }
      }
      // Fallback: mark the last line
      const lines = content.split('\n')
      return {
        line: lines.length - 1,
        column: 0,
        message: e.message,
      }
    }
    return null
  }
}

function highlightJsonWithErrors(content: string, error: JsonError | null): string {
  if (!content.trim()) return ''

  const lines = content.split('\n')
  const highlightedLines = lines.map((line, index) => {
    let escapedLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    // Apply syntax highlighting
    const patterns = [
      {
        regex: /("(?:[^"\\]|\\.)*")(\s*:)/g,
        replacement: '<span class="text-purple-400">$1</span>$2',
      },
      {
        regex: /:\s*("(?:[^"\\]|\\.)*")/g,
        replacement: ': <span class="text-green-400">$1</span>',
      },
      { regex: /:\s*(-?\d+\.?\d*)/g, replacement: ': <span class="text-amber-400">$1</span>' },
      { regex: /:\s*(true|false)/g, replacement: ': <span class="text-blue-400">$1</span>' },
      { regex: /:\s*(null)/g, replacement: ': <span class="text-red-400">$1</span>' },
    ]

    patterns.forEach(({ regex, replacement }) => {
      escapedLine = escapedLine.replace(regex, replacement)
    })

    // Add error squiggly underline on the error line
    if (error && index === error.line) {
      escapedLine = `<span class="decoration-wavy decoration-red-500 underline">${escapedLine}</span>`
    }

    return escapedLine
  })

  return highlightedLines.join('\n')
}

function highlightXmlString(content: string): string {
  if (!content.trim()) return ''

  // First escape HTML entities
  let escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // Use placeholders to avoid regex conflicts with inserted HTML
  const placeholders: string[] = []
  const placeholder = (html: string) => {
    const index = placeholders.length
    placeholders.push(html)
    return `\x00${index}\x00`
  }

  // Highlight tags (opening and closing)
  escaped = escaped.replace(/(&lt;\/?)([\w-]+)/g, (_, prefix, tagName) => {
    return placeholder(`<span class="text-blue-400">${prefix}${tagName}</span>`)
  })

  // Highlight attribute names (word followed by =)
  escaped = escaped.replace(/(\s)([\w-]+)(=)/g, (_, space, attrName, eq) => {
    return `${space}${placeholder(`<span class="text-purple-400">${attrName}</span>`)}${eq}`
  })

  // Highlight attribute values
  escaped = escaped.replace(/(=)("(?:[^"\\]|\\.)*")/g, (_, eq, value) => {
    return `${eq}${placeholder(`<span class="text-green-400">${value}</span>`)}`
  })

  // Restore placeholders
  escaped = escaped.replace(/\x00(\d+)\x00/g, (_, index) => placeholders[parseInt(index, 10)])

  return escaped
}

export function RequestBodyEditor({
  value,
  onChange,
  bodyType,
  onBodyTypeChange,
  rawType,
  onRawTypeChange,
  formData,
  onFormDataChange,
}: RequestBodyEditorProps) {
  const [binaryFileName, setBinaryFileName] = useState<string>('')
  const [isMaximized, setIsMaximized] = useState(false)

  // Memoize JSON error detection
  const jsonError = useMemo(() => {
    if (rawType === 'json' && value.trim()) {
      return parseJsonError(value)
    }
    return null
  }, [value, rawType])

  const updateFormDataEntry = (
    index: number,
    field: keyof FormDataEntry,
    newValue: string | boolean,
  ) => {
    const updated = [...formData]
    updated[index] = { ...updated[index], [field]: newValue }
    onFormDataChange(updated)
  }

  const addFormDataEntry = () => {
    onFormDataChange([...formData, { key: '', value: '', enabled: true }])
  }

  const removeFormDataEntry = (index: number) => {
    onFormDataChange(formData.filter((_, i) => i !== index))
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setBinaryFileName(file.name)
      // For binary, we store a placeholder - actual file handling would be done at request time
      onChange(`[Binary file: ${file.name}]`)
    }
  }

  const formatContent = () => {
    if (!value.trim()) {
      toast.error('No content to format')
      return
    }

    if (rawType === 'json') {
      try {
        const parsed = JSON.parse(value)
        const formatted = JSON.stringify(parsed, null, 2)
        onChange(formatted)
        toast.success('JSON formatted')
      } catch {
        toast.error('Invalid JSON - cannot format')
      }
    } else if (rawType === 'xml') {
      try {
        // Simple XML formatting
        let formatted = value
          .replace(/>\s*</g, '>\n<') // Add newlines between tags
          .replace(/(<[^\/!][^>]*[^\/]>)(?=\s*<[^\/])/g, '$1\n') // Newline after opening tags
          .trim()

        // Add indentation
        const lines = formatted.split('\n')
        let indent = 0
        const indentedLines = lines.map((line) => {
          const trimmed = line.trim()
          if (!trimmed) return ''

          // Decrease indent for closing tags
          if (trimmed.startsWith('</') || trimmed.startsWith('?>')) {
            indent = Math.max(0, indent - 1)
          }

          const result = '  '.repeat(indent) + trimmed

          // Increase indent for opening tags (not self-closing)
          if (
            trimmed.startsWith('<') &&
            !trimmed.startsWith('</') &&
            !trimmed.startsWith('<?') &&
            !trimmed.startsWith('<!') &&
            !trimmed.endsWith('/>') &&
            !trimmed.includes('</')
          ) {
            indent++
          }

          return result
        })

        onChange(indentedLines.join('\n'))
        toast.success('XML formatted')
      } catch {
        toast.error('Failed to format XML')
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Body Type Selector */}
      <RadioGroup
        value={bodyType}
        onValueChange={(val) => onBodyTypeChange(val as BodyType)}
        className="flex flex-wrap gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="none" id="body-none" />
          <Label htmlFor="body-none" className="text-sm cursor-pointer">
            none
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="form-data" id="body-form-data" />
          <Label htmlFor="body-form-data" className="text-sm cursor-pointer">
            form-data
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="x-www-form-urlencoded" id="body-urlencoded" />
          <Label htmlFor="body-urlencoded" className="text-sm cursor-pointer">
            x-www-form-urlencoded
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="raw" id="body-raw" />
          <Label htmlFor="body-raw" className="text-sm cursor-pointer">
            raw
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="binary" id="body-binary" />
          <Label htmlFor="body-binary" className="text-sm cursor-pointer">
            binary
          </Label>
        </div>
      </RadioGroup>

      {bodyType === 'raw' && (
        <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
          <Select value={rawType} onValueChange={(val) => onRawTypeChange(val as RawType)}>
            <SelectTrigger className="w-24 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="xml">XML</SelectItem>
              <SelectItem value="text">Text</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            {rawType !== 'text' && (
              <Button variant="outline" size="sm" onClick={formatContent} className="h-8 gap-2">
                <AlignLeft className="h-4 w-4" />
                Format
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMaximized(true)}
              className="h-8 w-8 p-0"
              title="Maximize"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Content Area based on body type */}
      {bodyType === 'none' && (
        <div className="text-center py-12 text-muted-foreground">
          <p>This request does not have a body</p>
        </div>
      )}

      {(bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded') && (
        <div className="space-y-3">
          {formData.map((entry, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={entry.enabled}
                onChange={(e) => updateFormDataEntry(index, 'enabled', e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Input
                placeholder="Key"
                value={entry.key}
                onChange={(e) => updateFormDataEntry(index, 'key', e.target.value)}
                className="flex-1 bg-background"
              />
              <Input
                placeholder="Value"
                value={entry.value}
                onChange={(e) => updateFormDataEntry(index, 'value', e.target.value)}
                className="flex-1 bg-background"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeFormDataEntry(index)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addFormDataEntry}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
      )}

      {bodyType === 'raw' && (
        <div className="flex flex-col border border-border rounded-md bg-background overflow-hidden">
          <div className="relative min-h-[300px] flex-1">
            {/* Syntax highlighted layer */}
            <pre
              className="absolute inset-0 p-3 font-mono text-sm pointer-events-none overflow-auto whitespace-pre-wrap break-words"
              aria-hidden="true"
            >
              <code
                dangerouslySetInnerHTML={{
                  __html:
                    (rawType === 'json'
                      ? highlightJsonWithErrors(value, jsonError)
                      : rawType === 'xml'
                        ? highlightXmlString(value)
                        : value
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')) || '&nbsp;',
                }}
              />
            </pre>
            {/* Editable textarea */}
            <textarea
              placeholder={
                rawType === 'json'
                  ? '{"key": "value"}'
                  : rawType === 'xml'
                    ? '<root>\n  <element>value</element>\n</root>'
                    : 'Enter plain text...'
              }
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                const target = e.target as HTMLTextAreaElement
                const { selectionStart, selectionEnd } = target

                // Handle Tab key
                if (e.key === 'Tab') {
                  e.preventDefault()
                  const newValue =
                    value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd)
                  onChange(newValue)
                  setTimeout(() => {
                    target.selectionStart = target.selectionEnd = selectionStart + 2
                  }, 0)
                }

                // Handle Enter key with auto-indent
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const beforeCursor = value.substring(0, selectionStart)
                  const afterCursor = value.substring(selectionEnd)

                  const currentLine = beforeCursor.split('\n').pop() || ''
                  const currentIndent = currentLine.match(/^(\s*)/)?.[1] || ''

                  const charBefore = beforeCursor.trim().slice(-1)
                  const charAfter = afterCursor.trim().charAt(0)
                  const shouldIndent = ['{', '['].includes(charBefore)
                  const shouldAddClosingIndent = shouldIndent && ['}', ']'].includes(charAfter)

                  let newValue: string
                  let cursorOffset: number

                  if (shouldAddClosingIndent) {
                    newValue =
                      beforeCursor +
                      '\n' +
                      currentIndent +
                      '  ' +
                      '\n' +
                      currentIndent +
                      afterCursor
                    cursorOffset = selectionStart + 1 + currentIndent.length + 2
                  } else if (shouldIndent) {
                    newValue = beforeCursor + '\n' + currentIndent + '  ' + afterCursor
                    cursorOffset = selectionStart + 1 + currentIndent.length + 2
                  } else {
                    newValue = beforeCursor + '\n' + currentIndent + afterCursor
                    cursorOffset = selectionStart + 1 + currentIndent.length
                  }

                  onChange(newValue)
                  setTimeout(() => {
                    target.selectionStart = target.selectionEnd = cursorOffset
                  }, 0)
                }
              }}
              className="relative w-full h-full min-h-[300px] font-mono text-sm p-3 resize-y bg-transparent text-transparent caret-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              style={{ caretColor: 'hsl(var(--foreground))' }}
              spellCheck={false}
            />
          </div>
          {/* Status bar ribbon */}
          <div className="flex items-center justify-end px-3 py-1 border-t border-border bg-muted/50 text-xs text-muted-foreground">
            <span>{value.length.toLocaleString()} chars</span>
          </div>
        </div>
      )}

      {bodyType === 'binary' && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <input type="file" id="binary-file" className="hidden" onChange={handleFileSelect} />
            <label
              htmlFor="binary-file"
              className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
            >
              {binaryFileName ? (
                <div className="space-y-2">
                  <p className="font-medium text-foreground">{binaryFileName}</p>
                  <p className="text-sm">Click to select a different file</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-medium">Select File</p>
                  <p className="text-sm">Click to select a file to upload</p>
                </div>
              )}
            </label>
          </div>
        </div>
      )}

      {/* Maximize Dialog for Raw Body */}
      {bodyType === 'raw' && (
        <Dialog open={isMaximized} onOpenChange={setIsMaximized}>
          <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] flex flex-col p-0">
            <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between pr-8">
                <DialogTitle>Request Body ({rawType.toUpperCase()})</DialogTitle>
                <div className="flex items-center gap-2">
                  {rawType !== 'text' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={formatContent}
                      className="h-8 gap-2"
                    >
                      <AlignLeft className="h-4 w-4" />
                      Format
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMaximized(false)}
                    className="h-8 w-8 p-0"
                    title="Minimize"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-hidden p-6">
              <div className="relative h-full border border-border rounded-md bg-background overflow-hidden">
                {/* Syntax highlighted layer */}
                <pre
                  className="absolute inset-0 p-3 font-mono text-sm pointer-events-none overflow-auto whitespace-pre-wrap break-words"
                  aria-hidden="true"
                >
                  <code
                    dangerouslySetInnerHTML={{
                      __html:
                        (rawType === 'json'
                          ? highlightJsonWithErrors(value, jsonError)
                          : rawType === 'xml'
                            ? highlightXmlString(value)
                            : value
                                .replace(/&/g, '&amp;')
                                .replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;')) || '&nbsp;',
                    }}
                  />
                </pre>
                {/* Editable textarea */}
                <textarea
                  placeholder={
                    rawType === 'json'
                      ? '{"key": "value"}'
                      : rawType === 'xml'
                        ? '<root>\n  <element>value</element>\n</root>'
                        : 'Enter plain text...'
                  }
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    const { selectionStart, selectionEnd } = target

                    // Handle Tab key
                    if (e.key === 'Tab') {
                      e.preventDefault()
                      const newValue =
                        value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd)
                      onChange(newValue)
                      setTimeout(() => {
                        target.selectionStart = target.selectionEnd = selectionStart + 2
                      }, 0)
                    }

                    // Handle Enter key with auto-indent
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const beforeCursor = value.substring(0, selectionStart)
                      const afterCursor = value.substring(selectionEnd)

                      const currentLine = beforeCursor.split('\n').pop() || ''
                      const currentIndent = currentLine.match(/^(\s*)/)?.[1] || ''

                      const charBefore = beforeCursor.trim().slice(-1)
                      const charAfter = afterCursor.trim().charAt(0)
                      const shouldIndent = ['{', '['].includes(charBefore)
                      const shouldAddClosingIndent = shouldIndent && ['}', ']'].includes(charAfter)

                      let newValue: string
                      let cursorOffset: number

                      if (shouldAddClosingIndent) {
                        newValue =
                          beforeCursor +
                          '\n' +
                          currentIndent +
                          '  ' +
                          '\n' +
                          currentIndent +
                          afterCursor
                        cursorOffset = selectionStart + 1 + currentIndent.length + 2
                      } else if (shouldIndent) {
                        newValue = beforeCursor + '\n' + currentIndent + '  ' + afterCursor
                        cursorOffset = selectionStart + 1 + currentIndent.length + 2
                      } else {
                        newValue = beforeCursor + '\n' + currentIndent + afterCursor
                        cursorOffset = selectionStart + 1 + currentIndent.length
                      }

                      onChange(newValue)
                      setTimeout(() => {
                        target.selectionStart = target.selectionEnd = cursorOffset
                      }, 0)
                    }
                  }}
                  className="relative w-full h-full font-mono text-sm p-3 resize-none bg-transparent text-transparent caret-foreground focus:outline-none"
                  style={{ caretColor: 'hsl(var(--foreground))' }}
                  spellCheck={false}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export type { BodyType, FormDataEntry, RawType }

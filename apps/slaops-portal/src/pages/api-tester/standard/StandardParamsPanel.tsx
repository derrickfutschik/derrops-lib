import {
  BodyType,
  FormDataEntry,
  RawType,
  RequestBodyEditor,
} from '@/components/api-tester/RequestBodyEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type KeyValuePair } from '@/hooks/useSendRequest'
import { clearFocusedQueryParam, setFocusedQueryParam } from '@/store/apiTesterSlice'
import { useAppDispatch } from '@/store/hooks'
import { Plus, Trash2 } from 'lucide-react'

interface StandardParamsPanelProps {
  activeTab: string
  onActiveTabChange: (tab: string) => void
  queryParams: KeyValuePair[]
  onAddQueryParam: () => void
  onRemoveQueryParam: (i: number) => void
  onUpdateQueryParam: (i: number, field: keyof KeyValuePair, value: string | boolean) => void
  headers: KeyValuePair[]
  onAddHeader: () => void
  onRemoveHeader: (i: number) => void
  onUpdateHeader: (i: number, field: keyof KeyValuePair, value: string | boolean) => void
  body: string
  onBodyChange: (body: string) => void
  bodyType: BodyType
  onBodyTypeChange: (type: BodyType) => void
  rawType: RawType
  onRawTypeChange: (type: RawType) => void
  formData: FormDataEntry[]
  onFormDataChange: (data: FormDataEntry[]) => void
  getQueryParamValidationStatus: (
    key: string,
  ) => { isValid: boolean; isUnspecified: boolean } | null
  getHeaderValidationStatus: (key: string) => { isValid: boolean; isUnspecified: boolean } | null
  getValidationBorderClass: (
    status: { isValid: boolean; isUnspecified: boolean } | null,
    isDuplicate: boolean,
  ) => string
  isQueryParamDuplicate: (i: number, key: string) => boolean
  isHeaderDuplicate: (i: number, key: string) => boolean
}

export function StandardParamsPanel({
  activeTab,
  onActiveTabChange,
  queryParams,
  onAddQueryParam,
  onRemoveQueryParam,
  onUpdateQueryParam,
  headers,
  onAddHeader,
  onRemoveHeader,
  onUpdateHeader,
  body,
  onBodyChange,
  bodyType,
  onBodyTypeChange,
  rawType,
  onRawTypeChange,
  formData,
  onFormDataChange,
  getQueryParamValidationStatus,
  getHeaderValidationStatus,
  getValidationBorderClass,
  isQueryParamDuplicate,
  isHeaderDuplicate,
}: StandardParamsPanelProps) {
  const dispatch = useAppDispatch()

  return (
    <Tabs value={activeTab} onValueChange={onActiveTabChange} className="w-full">
      <TabsList className="w-full justify-start bg-muted/50">
        <TabsTrigger value="params">Query Params</TabsTrigger>
        <TabsTrigger value="headers">Headers</TabsTrigger>
        <TabsTrigger value="body">Body</TabsTrigger>
      </TabsList>

      <TabsContent value="params" className="space-y-3 mt-4">
        {queryParams.map((param, index) => {
          const validationStatus = param.enabled ? getQueryParamValidationStatus(param.key) : null
          const isDuplicate = param.enabled ? isQueryParamDuplicate(index, param.key) : false
          const borderClass = getValidationBorderClass(validationStatus, isDuplicate)
          return (
            <div key={index} className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={param.enabled}
                onChange={(e) => onUpdateQueryParam(index, 'enabled', e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Input
                placeholder="Parameter name"
                value={param.key}
                onChange={(e) => onUpdateQueryParam(index, 'key', e.target.value)}
                onFocus={() => dispatch(setFocusedQueryParam({ index, field: 'key' }))}
                onBlur={() => dispatch(clearFocusedQueryParam())}
                className={`flex-1 bg-background ${borderClass}`}
              />
              <Input
                placeholder="Value"
                value={param.value}
                onChange={(e) => onUpdateQueryParam(index, 'value', e.target.value)}
                onFocus={() => dispatch(setFocusedQueryParam({ index, field: 'value' }))}
                onBlur={() => dispatch(clearFocusedQueryParam())}
                className={`flex-1 bg-background ${borderClass}`}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveQueryParam(index)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
        <Button variant="outline" size="sm" onClick={onAddQueryParam}>
          <Plus className="h-4 w-4 mr-2" />
          Add Parameter
        </Button>
      </TabsContent>

      <TabsContent value="headers" className="space-y-3 mt-4">
        {headers.map((header, index) => {
          const validationStatus = header.enabled ? getHeaderValidationStatus(header.key) : null
          const isDuplicate = header.enabled ? isHeaderDuplicate(index, header.key) : false
          const borderClass = getValidationBorderClass(validationStatus, isDuplicate)
          return (
            <div key={index} className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={header.enabled}
                onChange={(e) => onUpdateHeader(index, 'enabled', e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Input
                placeholder="Header name"
                value={header.key}
                onChange={(e) => onUpdateHeader(index, 'key', e.target.value)}
                className={`flex-1 bg-background ${borderClass}`}
              />
              <Input
                placeholder="Value"
                value={header.value}
                onChange={(e) => onUpdateHeader(index, 'value', e.target.value)}
                className={`flex-1 bg-background ${borderClass}`}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveHeader(index)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
        <Button variant="outline" size="sm" onClick={onAddHeader}>
          <Plus className="h-4 w-4 mr-2" />
          Add Header
        </Button>
      </TabsContent>

      <TabsContent value="body" className="mt-4">
        <RequestBodyEditor
          value={body}
          onChange={onBodyChange}
          bodyType={bodyType}
          onBodyTypeChange={onBodyTypeChange}
          rawType={rawType}
          onRawTypeChange={onRawTypeChange}
          formData={formData}
          onFormDataChange={onFormDataChange}
        />
      </TabsContent>
    </Tabs>
  )
}

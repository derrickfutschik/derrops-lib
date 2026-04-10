import { CloudRelayConnection, CloudRelayConnectionDeliveryModeEnum } from '@/client/slaops-cloud'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Globe, Server } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// ── Types ──────────────────────────────────────────────────────────────────

export interface RelaySelectorProps {
  connectionId: string | null
  connections: CloudRelayConnection[]
  isLoading: boolean
  onSelect: (id: string | null) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────

const BROWSER_VALUE = '__browser__'

function deliveryModeBadge(mode: string) {
  const isHttp =
    mode === CloudRelayConnectionDeliveryModeEnum.Direct ||
    mode === CloudRelayConnectionDeliveryModeEnum.RelayQueue
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono ml-1">
      {isHttp ? 'HTTP' : 'SQS'}
    </Badge>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export function RelaySelector({ connectionId, connections, isLoading, onSelect }: RelaySelectorProps) {
  const navigate = useNavigate()

  const localConnections = connections.filter((c) => c.type === 'local-dev')
  const remoteConnections = connections.filter((c) => c.type !== 'local-dev')

  const value = connectionId ?? BROWSER_VALUE

  function handleChange(val: string) {
    if (val === BROWSER_VALUE) {
      onSelect(null)
    } else if (val === '__manage__') {
      navigate('/connections')
    } else {
      onSelect(val)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Select value={value} onValueChange={handleChange} disabled={isLoading}>
        <SelectTrigger className="h-8 text-xs bg-background w-56">
          <SelectValue placeholder="Select relay…" />
        </SelectTrigger>
        <SelectContent className="z-50">
          {/* Browser option */}
          <SelectItem value={BROWSER_VALUE}>
            <span className="flex items-center gap-1.5">
              <Globe className="h-3 w-3" />
              Browser (direct)
            </span>
          </SelectItem>

          {/* Remote connections */}
          {remoteConnections.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-[10px]">Connections</SelectLabel>
                {remoteConnections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center">
                      {c.name}
                      {deliveryModeBadge(c.delivery_mode)}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}

          {/* Local connections */}
          {localConnections.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-[10px]">Local</SelectLabel>
                {localConnections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center">
                      {c.name}
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                        Local
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}

          {/* Manage link */}
          <SelectSeparator />
          <SelectItem value="__manage__" className="text-muted-foreground text-xs">
            Manage connections →
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

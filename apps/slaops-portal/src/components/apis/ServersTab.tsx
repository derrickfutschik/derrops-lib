import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface Server {
  rawUrl: string
  hostShape?: string
  basePath?: string
  scheme?: string
}

interface ServersTabProps {
  servers: Server[]
}

function SchemeBadge({ scheme }: { scheme?: string }) {
  if (scheme === 'https') return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0 text-xs">https</Badge>
  if (scheme === 'http') return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-0 text-xs">http</Badge>
  return <Badge variant="secondary" className="text-xs">{scheme ?? '—'}</Badge>
}

export function ServersTab({ servers }: ServersTabProps) {
  if (servers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Servers will appear here after the spec is indexed.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>URL</TableHead>
          <TableHead>Host shape</TableHead>
          <TableHead>Base path</TableHead>
          <TableHead className="w-20">Scheme</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {servers.map((server, i) => (
          <TableRow key={i}>
            <TableCell className="font-mono text-xs">{server.rawUrl}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{server.hostShape ?? '—'}</TableCell>
            <TableCell className="font-mono text-xs">{server.basePath ?? '/'}</TableCell>
            <TableCell><SchemeBadge scheme={server.scheme} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

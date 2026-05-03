import type { ApiEntity } from '@/client/derrops-cloud'
import { ApiEntityManagementModeEnum } from '@/client/derrops-cloud'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { useDeleteApi } from '@/hooks/useApisApi'
import { formatDistanceToNow } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiManagementModeBadge } from './ApiManagementModeBadge'
import { ApiStrategyBadge } from './ApiStrategyBadge'

interface ApiTableProps {
  apis: ApiEntity[]
  isLoading: boolean
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 7 }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export function ApiTable({ apis, isLoading }: ApiTableProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const deleteMutation = useDeleteApi()
  const [deleteTarget, setDeleteTarget] = useState<ApiEntity | null>(null)

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast({ title: 'API deleted', description: `${deleteTarget.name} has been removed.` })
    } catch (error: unknown) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'destructive',
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-24">Mode</TableHead>
            <TableHead className="w-24">Version</TableHead>
            <TableHead className="w-24">Operations</TableHead>
            <TableHead className="w-20">Servers</TableHead>
            <TableHead className="w-28">Strategy</TableHead>
            <TableHead className="w-32">Last indexed</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <SkeletonRows />}
          {!isLoading &&
            apis.map((api) => (
              <TableRow
                key={api.id}
                className="cursor-pointer hover:bg-secondary/50"
                onClick={() => navigate(`/apis/${api.id}`)}
              >
                <TableCell className="font-medium">{api.name}</TableCell>
                <TableCell>
                  <ApiManagementModeBadge mode={api.managementMode} />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {api.oaSpec?.latestVersion ?? '—'}
                </TableCell>
                <TableCell>{api.oaSpec?.operationCount ?? '—'}</TableCell>
                <TableCell>{api.oaSpec?.serverCount ?? '—'}</TableCell>
                <TableCell>
                  {api.managementMode !== ApiEntityManagementModeEnum.Platform && (
                    <ApiStrategyBadge strategy={api.fetch?.strategy} />
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {api.oaSpec?.lastIndexedAt
                    ? formatDistanceToNow(new Date(api.oaSpec.lastIndexedAt), { addSuffix: true })
                    : 'Never'}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(api)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and remove it from
              OpenSearch. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

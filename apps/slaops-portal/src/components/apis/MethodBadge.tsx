import { cn } from '@/lib/utils'

const METHOD_CLASSES: Record<string, string> = {
  GET:     'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  POST:    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  PUT:     'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  DELETE:  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  PATCH:   'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  HEAD:    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  OPTIONS: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

interface MethodBadgeProps {
  method: string
}

export function MethodBadge({ method }: MethodBadgeProps) {
  const upper = method.toUpperCase()
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold',
        METHOD_CLASSES[upper] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      )}
    >
      {upper}
    </span>
  )
}

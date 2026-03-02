import { cn } from '@/lib/utils'

type Status = 'active' | 'inactive' | 'pending'

const labels: Record<Status, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  pending: 'Pendente',
}

const styles: Record<Status, string> = {
  active: 'bg-amber-dark/10 text-amber-dark',
  inactive: 'bg-gray-100 text-gray-500',
  pending: 'bg-amber-bright/20 text-amber-dark',
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles[status],
        className,
      )}
    >
      {labels[status]}
    </span>
  )
}

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { ToastEvent, ToastType } from '@/lib/toast'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

const typeStyles: Record<ToastType, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-blue-steel text-white',
}

let nextId = 0

export function ToastContainer() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  React.useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent<ToastEvent>).detail
      const id = ++nextId
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 3500)
    }
    window.addEventListener('nocrato:toast', handler)
    return () => window.removeEventListener('nocrato:toast', handler)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg text-sm font-medium min-w-64 max-w-sm',
            typeStyles[t.type],
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}

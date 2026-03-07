import * as React from 'react'
import { cn } from '@/lib/utils'

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}

const SelectContext = React.createContext<SelectContextValue>({
  value: '',
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
})

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

export function Select({ value, defaultValue = '', onValueChange, children }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)

  const activeValue = value ?? internalValue
  const handleChange = (v: string) => {
    setInternalValue(v)
    onValueChange?.(v)
    setOpen(false)
  }

  // Close on outside click
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <SelectContext.Provider value={{ value: activeValue, onValueChange: handleChange, open, setOpen }}>
      <div ref={ref} className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

interface SelectTriggerProps {
  children: React.ReactNode
  className?: string
  id?: string
}

export function SelectTrigger({ children, className, id }: SelectTriggerProps) {
  const { open, setOpen } = React.useContext(SelectContext)
  return (
    <button
      id={id}
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-[#e8dfc8] bg-white px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-amber-dark/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {children}
      <svg
        className={cn('h-4 w-4 text-amber-mid transition-transform', open && 'rotate-180')}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = React.useContext(SelectContext)
  return (
    <span className={cn(!value && 'text-amber-mid/60')}>
      {value || placeholder}
    </span>
  )
}

export function SelectContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { open } = React.useContext(SelectContext)
  if (!open) return null

  return (
    <div
      className={cn(
        'absolute z-50 mt-1 w-full rounded-md border border-[#e8dfc8] bg-white shadow-lg',
        className,
      )}
    >
      <div className="py-1">{children}</div>
    </div>
  )
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function SelectItem({ value, children, className }: SelectItemProps) {
  const { value: activeValue, onValueChange } = React.useContext(SelectContext)
  const isSelected = activeValue === value

  return (
    <button
      type="button"
      onClick={() => onValueChange(value)}
      className={cn(
        'flex w-full items-center px-3 py-2 text-sm hover:bg-amber-bright/10 text-left transition-colors',
        isSelected && 'bg-amber-bright/20 font-medium text-amber-dark',
        className,
      )}
    >
      {children}
    </button>
  )
}

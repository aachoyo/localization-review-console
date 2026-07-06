import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { profileByCode } from '@/lib/languages'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  options: string[]
  onChange: (code: string) => void
}

/** Styled, animated language dropdown (replaces the native <select>). */
export function LangSelect({ value, options, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const label = profileByCode(value)?.name ?? value

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-2 rounded-md border border-border bg-white px-2.5 text-xs font-medium text-secondary-foreground transition-colors hover:border-primary"
      >
        {label}
        <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </button>

      <div
        className={cn(
          'absolute left-0 top-[calc(100%+6px)] z-50 min-w-[150px] origin-top rounded-lg border border-border bg-popover p-1 shadow-lg transition-all duration-150',
          open ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-95 opacity-0',
        )}
      >
        {options.map((code) => {
          const active = code === value
          return (
            <button
              key={code}
              type="button"
              onClick={() => {
                onChange(code)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors',
                active
                  ? 'bg-customBlue-50 font-medium text-foreground'
                  : 'text-secondary-foreground hover:bg-secondary',
              )}
            >
              {profileByCode(code)?.name ?? code}
              {active && <Check className="size-3.5 text-primary" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

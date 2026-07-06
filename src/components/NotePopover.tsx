import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { HighlightColor, PanelName } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface NoteDraft {
  mode: 'new' | 'edit'
  id?: string
  panel: PanelName
  start: number
  end: number
  text: string
  comment: string
  color: HighlightColor
  anchor: { left: number; top: number; bottom: number }
}

interface Props {
  draft: NoteDraft
  onChange: (patch: Partial<NoteDraft>) => void
  onSave: () => void
  onCancel: () => void
}

const BOX_W = 300
const BOX_H = 190

export function NotePopover({ draft, onChange, onSave, onCancel }: Props) {
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textRef.current?.focus()
  }, [])

  // position with viewport clamping
  let left = draft.anchor.left
  let top = draft.anchor.bottom + 8
  if (left + BOX_W > window.innerWidth - 12) left = window.innerWidth - BOX_W - 12
  if (top + BOX_H > window.innerHeight - 12) top = Math.max(12, draft.anchor.top - BOX_H - 8)
  left = Math.max(12, left)

  return (
    <div
      className="fixed z-50 rounded-xl border border-primary bg-popover p-3 shadow-2xl"
      style={{ left, top, width: BOX_W }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {draft.text && (
        <div className="mb-2 max-h-12 overflow-auto text-xs text-muted-foreground">
          Selected: “<span className="font-semibold text-foreground">{draft.text}</span>”
        </div>
      )}
      <Textarea
        ref={textRef}
        value={draft.comment}
        placeholder="Type your comment…"
        onChange={(e) => onChange({ comment: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSave()
          if (e.key === 'Escape') onCancel()
        }}
      />
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Severity:</span>
        {(['orange', 'red'] as HighlightColor[]).map((c) => (
          <button
            key={c}
            type="button"
            title={c === 'orange' ? 'Phrasing / flow' : 'Serious'}
            onClick={() => onChange({ color: c })}
            className={cn(
              'h-5 w-5 rounded-full transition-shadow',
              c === 'orange' ? 'bg-sev-orange' : 'bg-sev-red',
              draft.color === c ? 'ring-2 ring-[#334155] ring-offset-2' : 'ring-0',
            )}
          />
        ))}
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave}>
          Save
        </Button>
      </div>
    </div>
  )
}

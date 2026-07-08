import { Flag, X } from 'lucide-react'
import type { Highlight, RowFlag } from '@/lib/types'
import { useReviewStore } from '@/store/useReviewStore'
import { cn } from '@/lib/utils'

/** Notes for the currently shown take: its span highlights + the string's row flags. */
export function NoteList({ highlights, rowFlags }: { highlights: Highlight[]; rowFlags: RowFlag[] }) {
  const removeHighlight = useReviewStore((s) => s.removeHighlight)
  const removeRowFlag = useReviewStore((s) => s.removeRowFlag)

  const total = highlights.length + rowFlags.length
  if (total === 0) return null

  return (
    <div className="mt-4">
      <div className="mb-2 px-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Notes on this string ({total})
      </div>

      {highlights.map((h) => (
        <div
          key={h.id}
          className="mb-2 flex items-start gap-3 rounded-lg border border-border bg-secondary p-2.5"
        >
          <span
            className={cn('w-2 self-stretch rounded', h.color === 'orange' ? 'bg-sev-orange' : 'bg-sev-red')}
          />
          <div className="flex-1">
            <div className="text-[13px] text-muted-foreground">
              “<span className="font-semibold text-foreground">{h.text}</span>”{' '}
              <span className="text-muted-foreground">· {h.panel}</span>
            </div>
            <div className="text-sm">{h.comment}</div>
          </div>
          <button
            className="rounded p-1 text-muted-foreground hover:text-sev-red"
            title="Delete note"
            onClick={() => removeHighlight(h.id)}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}

      {rowFlags.map((f) => (
        <div
          key={f.id}
          className="mb-2 flex items-start gap-3 rounded-lg border border-border bg-secondary p-2.5"
        >
          <span className="w-2 self-stretch rounded bg-primary" />
          <div className="flex-1">
            <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
              <Flag className="size-3" /> row flag
            </div>
            <div className="text-sm">{f.comment}</div>
          </div>
          <button
            className="rounded p-1 text-muted-foreground hover:text-sev-red"
            title="Delete flag"
            onClick={() => removeRowFlag(f.id)}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

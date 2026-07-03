import { useReviewStore } from '@/store/useReviewStore'
import { cn } from '@/lib/utils'
import type { StringStatus } from '@/lib/types'

const dotColor: Record<StringStatus, string> = {
  untouched: 'bg-status-untouched',
  seen: 'bg-status-seen',
  flagged: 'bg-status-flagged',
}

export function Sidebar() {
  const strings = useReviewStore((s) => s.strings)
  const cursor = useReviewStore((s) => s.cursor)
  const setCursor = useReviewStore((s) => s.setCursor)
  const statusOf = useReviewStore((s) => s.statusOf)
  const hasAudio = useReviewStore((s) => s.hasAudio)

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col border-r border-border bg-[#12141a]">
      <div className="sticky top-0 flex items-center justify-between border-b border-border bg-[#12141a] px-3 py-2.5 text-xs text-muted-foreground">
        <span>Strings</span>
        <span>{strings.length}</span>
      </div>

      <div className="flex gap-2.5 border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <i className="inline-block size-2 rounded-full bg-status-untouched" />
          untouched
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="inline-block size-2 rounded-full bg-status-seen" />
          seen
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="inline-block size-2 rounded-full bg-status-flagged" />
          flagged
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul>
          {strings.map((s, i) => {
            const noAudio = !hasAudio(s)
            return (
              <li
                key={i}
                onClick={() => setCursor(i)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 border-b border-[#1a1d24] px-3 py-1.5 text-[13px] hover:bg-card',
                  i === cursor && 'bg-secondary shadow-[inset_3px_0_0_var(--primary)]',
                )}
              >
                <i
                  className={cn(
                    'inline-block size-2.5 flex-shrink-0 rounded-full',
                    dotColor[statusOf(s)],
                    noAudio && 'ring-2 ring-status-warn ring-inset',
                  )}
                  title={noAudio ? 'No audio matched' : undefined}
                />
                <span className="flex-1 truncate" title={s.key}>
                  {s.key || '(no key)'}
                </span>
                <span className="text-[11px] text-muted-foreground">{i + 1}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}

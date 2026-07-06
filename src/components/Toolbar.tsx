import { ChevronLeft, ChevronRight, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReviewStore } from '@/store/useReviewStore'

interface Props {
  onFlagRow: () => void
}

export function Toolbar({ onFlagRow }: Props) {
  const next = useReviewStore((s) => s.next)
  const prev = useReviewStore((s) => s.prev)
  const cursor = useReviewStore((s) => s.cursor)
  const total = useReviewStore((s) => s.strings.length)

  return (
    <div className="flex flex-shrink-0 items-center gap-2.5 border-t border-border bg-[#f8fafc] px-4 py-2">
      <Button variant="secondary" size="sm" onClick={prev} disabled={cursor <= 0}>
        <ChevronLeft /> Prev
      </Button>
      <Button variant="secondary" size="sm" onClick={next} disabled={cursor >= total - 1}>
        Next <ChevronRight />
      </Button>
      <Button variant="outline" size="sm" onClick={onFlagRow}>
        <Flag /> Flag whole row
      </Button>

      <div className="flex-1" />

      <span className="text-[11px] text-muted-foreground">
        <Kbd>Space</Kbd> play/pause · <Kbd>←</Kbd>/<Kbd>→</Kbd> navigate · select text to note
      </span>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <b className="rounded border border-border bg-secondary px-1.5 py-0.5 font-normal text-foreground">
      {children}
    </b>
  )
}

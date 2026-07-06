import { useRef } from 'react'
import type { Highlight, PanelName } from '@/lib/types'
import { readSelectionSpan, type SelectionSpan } from '@/hooks/useTextSelection'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  panel: PanelName
  text: string
  highlights: Highlight[]
  emptyText?: string
  onSelectSpan: (panel: PanelName, span: SelectionSpan) => void
  onClickHighlight: (id: string, rect: DOMRect) => void
  className?: string
  style?: React.CSSProperties
}

/** Render panel text with <mark> highlights sliced on sorted, non-overlapping ranges. */
function renderContent(
  text: string,
  highlights: Highlight[],
  onClickHighlight: (id: string, rect: DOMRect) => void,
) {
  const hs = [...highlights].sort((a, b) => a.start - b.start)
  const nodes: React.ReactNode[] = []
  let pos = 0
  hs.forEach((h) => {
    if (h.start < pos) return // skip overlaps
    if (h.start > pos) nodes.push(<span key={`t${pos}`}>{text.slice(pos, h.start)}</span>)
    nodes.push(
      <mark
        key={h.id}
        className={cn('hl', h.color)}
        title={h.comment}
        onClick={(e) => {
          e.stopPropagation()
          onClickHighlight(h.id, e.currentTarget.getBoundingClientRect())
        }}
      >
        {text.slice(h.start, h.end)}
      </mark>,
    )
    pos = h.end
  })
  if (pos < text.length) nodes.push(<span key="end">{text.slice(pos)}</span>)
  return nodes
}

export function TextPanel({
  label,
  panel,
  text,
  highlights,
  emptyText,
  onSelectSpan,
  onClickHighlight,
  className,
  style,
}: Props) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const isEmpty = !text

  function handleMouseUp() {
    if (isEmpty || !bodyRef.current) return
    const span = readSelectionSpan(bodyRef.current, text)
    if (span) onSelectSpan(panel, span)
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="px-4 pt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        ref={bodyRef}
        onMouseUp={handleMouseUp}
        style={style}
        className={cn(
          'whitespace-pre-wrap break-words px-4 pb-4 pt-2 leading-relaxed',
          isEmpty ? 'italic text-muted-foreground' : 'cursor-text select-text',
          className,
        )}
      >
        {isEmpty ? (emptyText ?? '—') : renderContent(text, highlights, onClickHighlight)}
      </div>
    </section>
  )
}

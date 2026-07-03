import type { PanelName, StringRow } from '@/lib/types'
import type { SelectionSpan } from '@/hooks/useTextSelection'
import { TextPanel } from './TextPanel'
import { NoteList } from './NoteList'

interface Props {
  row: StringRow
  index: number
  total: number
  onSelectSpan: (panel: PanelName, span: SelectionSpan) => void
  onEditHighlight: (id: string, rect: DOMRect) => void
}

export function StringView({ row, index, total, onSelectSpan, onEditHighlight }: Props) {
  const nepaliHls = row.highlights.filter((h) => h.panel === 'nepali')
  const romanHls = row.highlights.filter((h) => h.panel === 'roman')

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-baseline gap-4">
        <span className="font-mono text-[13px] text-muted-foreground">{row.key || '(no key)'}</span>
        <span className="ml-auto text-[13px] text-muted-foreground">
          String {index + 1} of {total}
        </span>
      </div>

      {/* English — source of truth (read-only, no highlighting) */}
      <section className="mb-3.5 rounded-xl border border-border bg-card">
        <div className="px-4 pt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          English
        </div>
        <div className="whitespace-pre-wrap break-words px-4 pb-4 pt-2 text-lg leading-relaxed">
          {row.english || <span className="italic text-muted-foreground">(no English text)</span>}
        </div>
      </section>

      <div className="mb-3.5">
        <TextPanel
          label="Nepali (Devanagari)"
          panel="nepali"
          text={row.nepali}
          highlights={nepaliHls}
          emptyText="(no Nepali text — skippable)"
          onSelectSpan={onSelectSpan}
          onClickHighlight={onEditHighlight}
          className="text-[22px]"
        />
      </div>

      <div className="mb-3.5">
        <TextPanel
          label="Romanized (plain phonetic)"
          panel="roman"
          text={row.roman}
          highlights={romanHls}
          emptyText="—"
          onSelectSpan={onSelectSpan}
          onClickHighlight={onEditHighlight}
          className="text-lg italic text-[#cfd6e4]"
        />
      </div>

      <NoteList row={row} />
    </div>
  )
}

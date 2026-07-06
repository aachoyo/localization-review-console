import type { PanelName, StringRow } from '@/lib/types'
import type { SelectionSpan } from '@/hooks/useTextSelection'
import { profileByCode } from '@/lib/languages'
import { useReviewStore } from '@/store/useReviewStore'
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
  const activeLang = useReviewStore((s) => s.activeLang)
  const showRomanization = useReviewStore((s) => s.showRomanization)
  const toggleChecked = useReviewStore((s) => s.toggleChecked)
  const profile = profileByCode(activeLang)

  const targetHls = row.highlights.filter((h) => h.panel === 'target')
  const romanHls = row.highlights.filter((h) => h.panel === 'roman')

  // Romanization is available when the profile has an engine or the sheet supplied one.
  const romanAvailable = !!profile?.romanize || !!row.transFromSheet
  const targetLabel = profile ? `${profile.name} (${profile.code})` : 'Target'

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-4">
        <span className="font-mono text-[13px] text-muted-foreground">{row.key || '(no key)'}</span>
        <label className="flex cursor-pointer select-none items-center gap-1.5 text-[13px] text-muted-foreground">
          <input
            type="checkbox"
            className="size-3.5 accent-status-checked"
            checked={row.checked}
            onChange={() => toggleChecked(index)}
          />
          Reviewed
        </label>
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
          label={targetLabel}
          panel="target"
          text={row.target}
          highlights={targetHls}
          emptyText="(no text — skippable)"
          onSelectSpan={onSelectSpan}
          onClickHighlight={onEditHighlight}
          className="text-[23px] leading-[1.7]"
          style={profile ? { fontFamily: profile.font } : undefined}
        />
      </div>

      {showRomanization && romanAvailable && (
        <div className="mb-3.5">
          <TextPanel
            label="Romanized (plain phonetic)"
            panel="roman"
            text={row.roman}
            highlights={romanHls}
            emptyText="—"
            onSelectSpan={onSelectSpan}
            onClickHighlight={onEditHighlight}
            className="text-lg italic leading-[1.65] text-[#475569]"
          />
        </div>
      )}

      <NoteList row={row} />
    </div>
  )
}

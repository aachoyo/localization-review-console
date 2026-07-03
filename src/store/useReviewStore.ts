import { create } from 'zustand'
import type { AudioIndex } from '@/lib/audio'
import { matchAudio } from '@/lib/audio'
import type { Highlight, HighlightColor, RowFlag, StringRow, StringStatus, PanelName } from '@/lib/types'
import { nextId } from '@/lib/utils'

interface ReviewState {
  strings: StringRow[]
  cursor: number
  audio: AudioIndex | null
  sheetBaseName: string

  // derived helpers
  current: () => StringRow | null
  statusOf: (row: StringRow) => StringStatus
  hasAudio: (row: StringRow) => boolean

  // loading
  loadStrings: (rows: StringRow[], baseName: string) => void
  setAudio: (index: AudioIndex) => void

  // navigation
  setCursor: (i: number) => void
  next: () => void
  prev: () => void

  // notes
  addHighlight: (draft: { panel: PanelName; start: number; end: number; text: string; comment: string; color: HighlightColor }) => void
  updateHighlight: (id: string, patch: { comment?: string; color?: HighlightColor }) => void
  removeHighlight: (id: string) => void
  addRowFlag: (comment: string) => void
  removeRowFlag: (id: string) => void
}

/** Immutably replace the row at `cursor`. */
function patchCurrent(rows: StringRow[], cursor: number, fn: (r: StringRow) => StringRow): StringRow[] {
  return rows.map((r, i) => (i === cursor ? fn(r) : r))
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  strings: [],
  cursor: 0,
  audio: null,
  sheetBaseName: 'sheet',

  current: () => {
    const { strings, cursor } = get()
    return strings[cursor] ?? null
  },
  statusOf: (row) => {
    if (row.highlights.length || row.rowFlags.length) return 'flagged'
    if (row.seen) return 'seen'
    return 'untouched'
  },
  hasAudio: (row) => matchAudio(get().audio, row.key) !== null,

  loadStrings: (rows, baseName) => {
    const marked = rows.map((r, i) => (i === 0 ? { ...r, seen: true } : r))
    set({ strings: marked, cursor: 0, sheetBaseName: baseName })
  },
  setAudio: (index) => set({ audio: index }),

  setCursor: (i) => {
    const { strings } = get()
    if (i < 0 || i >= strings.length) return
    set({
      cursor: i,
      strings: strings.map((r, idx) => (idx === i ? { ...r, seen: true } : r)),
    })
  },
  next: () => get().setCursor(get().cursor + 1),
  prev: () => get().setCursor(get().cursor - 1),

  addHighlight: (draft) =>
    set((s) => ({
      strings: patchCurrent(s.strings, s.cursor, (r) => ({
        ...r,
        highlights: [...r.highlights, { id: nextId('h'), ...draft } as Highlight],
      })),
    })),
  updateHighlight: (id, patch) =>
    set((s) => ({
      strings: patchCurrent(s.strings, s.cursor, (r) => ({
        ...r,
        highlights: r.highlights.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      })),
    })),
  removeHighlight: (id) =>
    set((s) => ({
      strings: patchCurrent(s.strings, s.cursor, (r) => ({
        ...r,
        highlights: r.highlights.filter((h) => h.id !== id),
      })),
    })),
  addRowFlag: (comment) =>
    set((s) => ({
      strings: patchCurrent(s.strings, s.cursor, (r) => ({
        ...r,
        rowFlags: [...r.rowFlags, { id: nextId('f'), comment } as RowFlag],
      })),
    })),
  removeRowFlag: (id) =>
    set((s) => ({
      strings: patchCurrent(s.strings, s.cursor, (r) => ({
        ...r,
        rowFlags: r.rowFlags.filter((f) => f.id !== id),
      })),
    })),
}))

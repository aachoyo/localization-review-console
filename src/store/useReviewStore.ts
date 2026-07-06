import { create } from 'zustand'
import type { AudioIndex, AudioVariant } from '@/lib/audio'
import { matchAudio, langFoldersInIndex } from '@/lib/audio'
import { parseWorkbook } from '@/lib/spreadsheet'
import { profileByCode, profileByFolder } from '@/lib/languages'
import type { Highlight, HighlightColor, RowFlag, StringRow, StringStatus, PanelName } from '@/lib/types'
import { nextId } from '@/lib/utils'

export type NoteAudioMode = 'keep-playing' | 'pause-resume'

interface ReviewState {
  strings: StringRow[]
  cursor: number
  audio: AudioIndex | null
  sheetBaseName: string
  /** retained workbook bytes so a language switch can re-extract the new column */
  workbookData: ArrayBuffer | null

  // language / variant
  activeLang: string
  availableLangs: string[]
  activeVariant: AudioVariant

  // settings
  showRomanization: boolean
  noteAudioMode: NoteAudioMode

  // derived helpers
  current: () => StringRow | null
  statusOf: (row: StringRow) => StringStatus
  hasAudio: (row: StringRow) => boolean

  // loading
  loadStrings: (rows: StringRow[], baseName: string) => void
  loadWorkbook: (data: ArrayBuffer, baseName: string) => Promise<string | undefined>
  setAudio: (index: AudioIndex) => void

  // language
  setActiveLang: (code: string) => Promise<void>
  setActiveVariant: (v: AudioVariant) => void

  // settings
  setShowRomanization: (v: boolean) => void
  setNoteAudioMode: (m: NoteAudioMode) => void

  // navigation
  setCursor: (i: number) => void
  next: () => void
  prev: () => void

  // completion
  toggleChecked: (index?: number) => void

  // notes
  addHighlight: (draft: { panel: PanelName; start: number; end: number; text: string; comment: string; color: HighlightColor }) => void
  updateHighlight: (id: string, patch: { comment?: string; color?: HighlightColor }) => void
  removeHighlight: (id: string) => void
  addRowFlag: (comment: string) => void
  removeRowFlag: (id: string) => void
}

/** Immutably replace the row at `index`. */
function patchAt(rows: StringRow[], index: number, fn: (r: StringRow) => StringRow): StringRow[] {
  return rows.map((r, i) => (i === index ? fn(r) : r))
}

/** Audio folder codes present ∩ registry, as ISO codes (e.g. ['bn','ne']). */
function deriveAvailableLangs(index: AudioIndex | null): string[] {
  const codes = new Set<string>()
  for (const folder of langFoldersInIndex(index)) {
    const p = profileByFolder(folder)
    if (p) codes.add(p.code)
  }
  return [...codes].sort()
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  strings: [],
  cursor: 0,
  audio: null,
  sheetBaseName: 'sheet',
  workbookData: null,

  activeLang: 'ne',
  availableLangs: [],
  activeVariant: 'base',

  showRomanization: false,
  noteAudioMode: 'pause-resume',

  current: () => {
    const { strings, cursor } = get()
    return strings[cursor] ?? null
  },
  statusOf: (row) => {
    if (row.highlights.length || row.rowFlags.length) return 'flagged'
    if (row.checked) return 'checked'
    if (row.seen) return 'visited'
    return 'untouched'
  },
  hasAudio: (row) => {
    const folder = profileByCode(get().activeLang)?.folderCode ?? get().activeLang.toUpperCase()
    return matchAudio(get().audio, folder, row.key, get().activeVariant) !== null
  },

  // WI-6: no auto-completion. Rows load untouched; navigation only marks "visited".
  loadStrings: (rows, baseName) => set({ strings: rows, cursor: 0, sheetBaseName: baseName }),

  loadWorkbook: async (data, baseName) => {
    const { activeLang } = get()
    const { rows, warning } = await parseWorkbook(data, activeLang)
    set({ workbookData: data, strings: rows, cursor: 0, sheetBaseName: baseName })
    return warning
  },

  setAudio: (index) => {
    const available = deriveAvailableLangs(index)
    set({ audio: index, availableLangs: available })
    // If the current language isn't among the loaded audio, switch to the first that is.
    const { activeLang } = get()
    if (available.length && !available.includes(activeLang)) void get().setActiveLang(available[0])
  },

  setActiveLang: async (code) => {
    const { workbookData } = get()
    if (!workbookData) {
      set({ activeLang: code, activeVariant: 'base' })
      return
    }
    const { rows } = await parseWorkbook(workbookData, code)
    set({ activeLang: code, activeVariant: 'base', strings: rows, cursor: 0 })
  },
  setActiveVariant: (v) => set({ activeVariant: v }),

  setShowRomanization: (v) => set({ showRomanization: v }),
  setNoteAudioMode: (m) => set({ noteAudioMode: m }),

  setCursor: (i) => {
    const { strings } = get()
    if (i < 0 || i >= strings.length) return
    // WI-6: mark visited only — never checked.
    set({ cursor: i, strings: patchAt(strings, i, (r) => (r.seen ? r : { ...r, seen: true })) })
  },
  next: () => get().setCursor(get().cursor + 1),
  prev: () => get().setCursor(get().cursor - 1),

  toggleChecked: (index) =>
    set((s) => {
      const i = index ?? s.cursor
      if (i < 0 || i >= s.strings.length) return s
      return { strings: patchAt(s.strings, i, (r) => ({ ...r, checked: !r.checked })) }
    }),

  addHighlight: (draft) =>
    set((s) => ({
      strings: patchAt(s.strings, s.cursor, (r) => ({
        ...r,
        highlights: [...r.highlights, { id: nextId('h'), ...draft } as Highlight],
      })),
    })),
  updateHighlight: (id, patch) =>
    set((s) => ({
      strings: patchAt(s.strings, s.cursor, (r) => ({
        ...r,
        highlights: r.highlights.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      })),
    })),
  removeHighlight: (id) =>
    set((s) => ({
      strings: patchAt(s.strings, s.cursor, (r) => ({
        ...r,
        highlights: r.highlights.filter((h) => h.id !== id),
      })),
    })),
  addRowFlag: (comment) =>
    set((s) => ({
      strings: patchAt(s.strings, s.cursor, (r) => ({
        ...r,
        rowFlags: [...r.rowFlags, { id: nextId('f'), comment } as RowFlag],
      })),
    })),
  removeRowFlag: (id) =>
    set((s) => ({
      strings: patchAt(s.strings, s.cursor, (r) => ({
        ...r,
        rowFlags: r.rowFlags.filter((f) => f.id !== id),
      })),
    })),
}))

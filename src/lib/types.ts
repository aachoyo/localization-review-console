export type PanelName = 'target' | 'roman'
export type HighlightColor = 'orange' | 'red'
export type StringStatus = 'untouched' | 'visited' | 'checked' | 'flagged'

/** Audio / text variant of a string. base = canonical, ksa = regional (Saudi) take, retail = alternate recording. */
export type AudioVariant = 'base' | 'ksa' | 'retail'

export interface Highlight {
  id: string
  panel: PanelName
  /** character offset into the panel's full plain text */
  start: number
  end: number
  /** the highlighted snippet text */
  text: string
  comment: string
  color: HighlightColor
}

export interface RowFlag {
  id: string
  comment: string
}

/**
 * One variant "take" of a logical string. Text, transliteration, and highlights
 * are per-take because a KSA take is a genuinely different string whose highlight
 * offsets only line up with its own text.
 */
export interface Take {
  /** full key incl. any `_KSA` suffix — used for audio-variant lookup fallback and export */
  key: string
  /** English source for this take (the take's own sheet row — may differ per variant) */
  english: string
  /** the active language's text (was `nepali` in v1) */
  target: string
  /** generated or sheet-supplied transliteration of `target` */
  roman: string
  /** transliteration value carried from the source sheet, if any */
  transFromSheet: string
  highlights: Highlight[]
}

/**
 * A logical string: one sidebar entry / cursor position. Holds a map of takes
 * (always a `base`; optionally `ksa`). Shared fields (english/submodule/seen/
 * checked/rowFlags) live at this level; per-variant text lives in `takes`.
 */
export interface StringRow {
  /** base (logical) key */
  key: string
  /** source sheet name this row came from — used to group the export by submodule */
  submodule: string
  takes: Partial<Record<AudioVariant, Take>>
  rowFlags: RowFlag[]
  /** visited: the reviewer navigated to this row (was the old `seen`) */
  seen: boolean
  /** manual completion: the reviewer explicitly ticked this row as reviewed */
  checked: boolean
}

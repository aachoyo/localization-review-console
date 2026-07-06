export type PanelName = 'target' | 'roman'
export type HighlightColor = 'orange' | 'red'
export type StringStatus = 'untouched' | 'visited' | 'checked' | 'flagged'

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

export interface StringRow {
  key: string
  english: string
  /** the active language's text (was `nepali` in v1) */
  target: string
  /** generated or sheet-supplied transliteration of `target` */
  roman: string
  /** transliteration value carried from the source sheet, if any */
  transFromSheet: string
  /** source sheet name this row came from — used to group the export by submodule */
  submodule: string
  highlights: Highlight[]
  rowFlags: RowFlag[]
  /** visited: the reviewer navigated to this row (was the old `seen`) */
  seen: boolean
  /** manual completion: the reviewer explicitly ticked this row as reviewed */
  checked: boolean
}

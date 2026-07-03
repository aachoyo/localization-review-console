export type PanelName = 'nepali' | 'roman'
export type HighlightColor = 'orange' | 'red'
export type StringStatus = 'untouched' | 'seen' | 'flagged'

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
  nepali: string
  roman: string
  /** transliteration value carried from the source sheet, if any */
  transFromSheet: string
  highlights: Highlight[]
  rowFlags: RowFlag[]
  seen: boolean
}

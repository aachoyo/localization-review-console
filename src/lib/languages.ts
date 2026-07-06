import { romanize } from './romanizer'

export type ScriptDirection = 'ltr' | 'rtl'

export interface LanguageProfile {
  /** ISO code as it appears (lowercased) in a sheet header's parentheses: 'ne','hi','bn','ta','ml' */
  code: string
  /** Display name for panel labels / dropdown: 'Nepali','Hindi',... */
  name: string
  /** Audio subfolder + sheet code, UPPER: 'NE','HI','BN',... */
  folderCode: string
  /** Script direction. All in-scope profiles are ltr; kept in the type so Phase 3 (RTL) drops in. */
  direction: ScriptDirection
  /** CSS font-family for rendering the target text. */
  font: string
  /** Optional romanization engine; omit if none for this release (F8 makes it optional). */
  romanize?: (text: string) => string
}

/**
 * Registry keyed by lowercase ISO code.
 *
 * ne/hi share the existing Devanagari engine. bn/ta/ml ship with no `romanize`
 * in this release — the panel is a progressive enhancement (F8). Add an engine
 * here later without touching call sites.
 */
export const LANGUAGES: Record<string, LanguageProfile> = {
  ne: {
    code: 'ne',
    name: 'Nepali',
    folderCode: 'NE',
    direction: 'ltr',
    font: "'Noto Sans Devanagari', sans-serif",
    romanize,
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    folderCode: 'HI',
    direction: 'ltr',
    font: "'Noto Sans Devanagari', sans-serif",
    romanize,
  },
  bn: {
    code: 'bn',
    name: 'Bengali',
    folderCode: 'BN',
    direction: 'ltr',
    font: "'Noto Sans Bengali', sans-serif",
    // no romanize engine yet
  },
  ta: {
    code: 'ta',
    name: 'Tamil',
    folderCode: 'TA',
    direction: 'ltr',
    font: "'Noto Sans Tamil', sans-serif",
    // no romanize engine yet
  },
  ml: {
    code: 'ml',
    name: 'Malayalam',
    folderCode: 'ML',
    direction: 'ltr',
    font: "'Noto Sans Malayalam', sans-serif",
    // no romanize engine yet
  },
}

/** Lookup by lowercase ISO code (e.g. 'bn'). */
export function profileByCode(code: string): LanguageProfile | undefined {
  return LANGUAGES[code.trim().toLowerCase()]
}

/** Lookup by audio folder / sheet code (e.g. 'NE'), case-insensitive. */
export function profileByFolder(folderCode: string): LanguageProfile | undefined {
  const fc = folderCode.trim().toUpperCase()
  return Object.values(LANGUAGES).find((p) => p.folderCode === fc)
}

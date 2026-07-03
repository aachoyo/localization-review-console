import { romanize } from './romanizer'
import type { StringRow } from './types'
import type { CellObject } from 'xlsx'

// SheetJS is large (~400 kB) and only needed on load/export, so it's loaded
// lazily and cached — this keeps it out of the initial bundle.
let _xlsx: typeof import('xlsx') | null = null
async function loadXLSX(): Promise<typeof import('xlsx')> {
  if (!_xlsx) {
    const mod = await import('xlsx-js-style')                          // ← runtime swap
    _xlsx = ((mod as { default?: unknown }).default ?? mod) as unknown as typeof import('xlsx')  // ← double cast
  }
  return _xlsx
}

export interface ParseResult {
  rows: StringRow[]
  warning?: string
}

/**
 * Parse a review workbook (first sheet). Matches columns by header text
 * (case-insensitive, tolerant of extra columns), skips blank rows, and
 * tolerates trailing empty rows. Read-only: never mutates the input.
 */
export async function parseWorkbook(data: ArrayBuffer): Promise<ParseResult> {
  const XLSX = await loadXLSX()
  const wb = XLSX.read(new Uint8Array(data), { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return { rows: [], warning: 'The workbook has no sheets.' }

  const grid = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false, defval: '' })
  if (!grid.length) return { rows: [], warning: 'The sheet appears empty.' }

  // header = first non-empty row
  let hIdx = 0
  while (hIdx < grid.length && grid[hIdx].every((c) => String(c).trim() === '')) hIdx++
  const headers = (grid[hIdx] || []).map((h) => String(h).trim().toLowerCase())

  const findCol = (pred: (h: string) => boolean) => headers.findIndex(pred)
  const cKey = findCol((h) => h.includes('key'))
  const cEng = findCol((h) => h.includes('english') && !h.includes('translit'))
  const cNep = findCol((h) => h.includes('nepali'))
  const cTrans = findCol((h) => h.includes('translit'))

  let warning: string | undefined
  if (cKey < 0 || cNep < 0) {
    warning =
      'Could not find the required "Key" and/or "Nepali" columns. ' +
      `Headers found: ${headers.filter(Boolean).join(', ') || '(none)'}.`
  }

  const rows: StringRow[] = []
  for (let r = hIdx + 1; r < grid.length; r++) {
    const row = grid[r] || []
    const get = (i: number) => (i >= 0 ? String(row[i] ?? '').trim() : '')
    const key = get(cKey)
    const english = get(cEng)
    const nepali = get(cNep)
    if (!key && !english && !nepali) continue // skip fully blank rows
    rows.push({
      key,
      english,
      nepali,
      roman: nepali ? romanize(nepali) : '',
      transFromSheet: get(cTrans),
      highlights: [],
      rowFlags: [],
      seen: false,
    })
  }

  return { rows, warning }
}

/** Build the Notes cell text for one string, per PRD §9. */
export function buildNotesCell(row: StringRow): string {
  const lines: string[] = []
  for (const h of row.highlights) lines.push(`"${h.text}" — ${h.comment}`)
  for (const f of row.rowFlags) lines.push(f.comment)
  return lines.join('\n')
}

/**
 * Export notes to a brand-new .xlsx. Columns: Key, English, Nepali, Romanized, Notes.
 * Never touches the input file.
 */
export async function exportNotes(rows: StringRow[], sheetBaseName: string): Promise<void> {
  const XLSX = await loadXLSX()
  const aoa: string[][] = [['Key', 'English', 'Nepali', 'Romanized', 'Notes']]
  for (const row of rows) {
    aoa.push([row.key, row.english, row.nepali, row.roman, buildNotesCell(row)])
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = Array(5).fill({ wpx: 250 })   // wpx = pixels; wch was characters

  // notes columns
  const range = XLSX.utils.decode_range(ws['!ref']!)
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as CellObject | undefined
      if (!cell) continue
      const font =
        r === 0
          ? { bold: true, color: { rgb: 'FFFFFF' }, name: 'Roboto Condensed' }  // header
          : { name: c === 2 ? 'Noto Sans Devanagari' : 'Roboto Condensed' }     // body
        ; (cell as { s?: unknown }).s = {
          font,
          alignment: { wrapText: true, vertical: 'top' },
          ...(r === 0 && { fill: { fgColor: { rgb: '000000' } } }),  // header 3: black fill
        }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Review Notes')
  XLSX.writeFile(wb, `review_notes_${sheetBaseName}.xlsx`)
}

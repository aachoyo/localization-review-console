import type { Highlight, StringRow } from './types'
import { profileByCode } from './languages'

// SheetJS is large (~400 kB) and only needed on load, so it's loaded lazily and
// cached — this keeps it out of the initial bundle. Reading only; the writer uses
// ExcelJS (see exportNotes) so styled output survives round-trips.
let _xlsx: typeof import('xlsx') | null = null
async function loadXLSX(): Promise<typeof import('xlsx')> {
  if (!_xlsx) _xlsx = await import('xlsx')
  return _xlsx
}

export interface ParseResult {
  rows: StringRow[]
  warning?: string
  /** registry codes found as columns across the reviewable sheets (excludes en) */
  workbookLangs: string[]
}

/** Extract a parenthesized ISO code from a header, e.g. "Nepali (ne)" -> "ne", "Bangla(bn)" -> "bn". */
function parenCode(header: string): string | null {
  const m = header.match(/\(\s*([a-z]{2,4})\s*\)/i)
  return m ? m[1].toLowerCase() : null
}

/**
 * Parse a review workbook. Iterates ALL sheets, treating any sheet with both a
 * `Key` column and an English `(en)` column as a reviewable submodule (Summary /
 * issue tabs are skipped). Columns are matched by their parenthesized ISO code,
 * tolerant of case and spacing.
 *
 * Confidentiality (PRD §6/F3): only Key, English, and the single active-language
 * column are read into memory — other language columns are never extracted.
 *
 * Read-only: never mutates the input.
 */
export async function parseWorkbook(data: ArrayBuffer, activeCode: string): Promise<ParseResult> {
  const XLSX = await loadXLSX()
  const wb = XLSX.read(new Uint8Array(data), { type: 'array' })
  if (!wb.SheetNames.length) return { rows: [], warning: 'The workbook has no sheets.', workbookLangs: [] }

  const active = activeCode.toLowerCase()
  const profile = profileByCode(active)
  const activeName = profile?.name.toLowerCase() ?? active

  const rows: StringRow[] = []
  const langsFound = new Set<string>()
  let sawReviewableSheet = false
  let sawActiveColumn = false

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue

    const grid = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false, defval: '' })
    if (!grid.length) continue

    // header = first non-empty row
    let hIdx = 0
    while (hIdx < grid.length && grid[hIdx].every((c) => String(c).trim() === '')) hIdx++
    const headers = (grid[hIdx] || []).map((h) => String(h).trim())
    const lower = headers.map((h) => h.toLowerCase())

    const cKey = lower.findIndex((h) => h.includes('key'))
    const cEng = headers.findIndex((h) => parenCode(h) === 'en')
    const cEngFallback = lower.findIndex((h) => h.includes('english') && !h.includes('translit'))
    const englishCol = cEng >= 0 ? cEng : cEngFallback

    // Reviewable submodule iff it has a Key and an English column.
    if (cKey < 0 || englishCol < 0) continue
    sawReviewableSheet = true

    // Record which registry languages this sheet exposes (for the selector / diagnostics).
    for (const h of headers) {
      const code = parenCode(h)
      if (code && code !== 'en' && profileByCode(code)) langsFound.add(code)
    }

    // Active-language target column: by ISO code, then name-substring fallback (legacy sheets).
    let cTarget = headers.findIndex((h) => parenCode(h) === active)
    if (cTarget < 0)
      cTarget = lower.findIndex((h) => h.includes(activeName) && !h.includes('translit') && !parenCode(h))

    // Sheet-supplied transliteration for the active language (e.g. "Urdu Transliterated").
    const cTrans = lower.findIndex(
      (h, i) => h.includes('translit') && (h.includes(activeName) || parenCode(headers[i]) === active),
    )

    if (cTarget >= 0) sawActiveColumn = true

    for (let r = hIdx + 1; r < grid.length; r++) {
      const row = grid[r] || []
      const get = (i: number) => (i >= 0 ? String(row[i] ?? '').trim() : '')
      const key = get(cKey)
      const english = get(englishCol)
      const target = get(cTarget)
      if (!key && !english && !target) continue // skip fully blank rows
      const transFromSheet = get(cTrans)
      rows.push({
        key,
        english,
        target,
        roman: profile?.romanize ? (target ? profile.romanize(target) : '') : transFromSheet || '',
        transFromSheet,
        submodule: sheetName,
        highlights: [],
        rowFlags: [],
        seen: false,
        checked: false,
      })
    }
  }

  let warning: string | undefined
  if (!sawReviewableSheet) {
    warning = 'No reviewable sheets found (each needs a "Key" and an English "(en)" column).'
  } else if (!sawActiveColumn) {
    const avail = [...langsFound].map((c) => profileByCode(c)?.name ?? c).join(', ')
    warning =
      `No "${profile?.name ?? active}" column found in the workbook. ` +
      (avail ? `Languages available: ${avail}.` : 'No language columns detected.')
  }

  return { rows, warning, workbookLangs: [...langsFound].sort() }
}

/** Build the Notes cell text for one string. */
export function buildNotesCell(row: StringRow): string {
  const lines: string[] = []
  for (const h of row.highlights) lines.push(`"${h.text}" — ${h.comment}`)
  for (const f of row.rowFlags) lines.push(f.comment)
  return lines.join('\n')
}

/** ARGB fill colors for highlighted runs, by severity. */
const RUN_COLOR: Record<'orange' | 'red', string> = {
  orange: 'FFF39C12',
  red: 'FFE74C3C',
}

interface RichRun {
  text: string
  font: { name: string; color?: { argb: string } }
}

/**
 * Split `text` into ExcelJS rich-text runs, coloring the exact flagged spans
 * (WI-8 / F7). `highlights` must already be filtered to the panel and hold offsets
 * into `text`. Highlights are non-overlapping; we sort, clamp, and skip any that
 * overlap a previous run defensively. Returns a plain string when there are none.
 */
export function buildRichText(text: string, highlights: Highlight[], font: string): { richText: RichRun[] } | string {
  const spans = highlights
    .map((h) => ({ start: Math.max(0, h.start), end: Math.min(text.length, h.end), color: h.color }))
    .filter((h) => h.end > h.start)
    .sort((a, b) => a.start - b.start)

  if (!spans.length) return text

  const runs: RichRun[] = []
  let cursor = 0
  for (const s of spans) {
    if (s.start < cursor) continue // overlaps a previous span — skip defensively
    if (s.start > cursor) runs.push({ text: text.slice(cursor, s.start), font: { name: font } })
    runs.push({ text: text.slice(s.start, s.end), font: { name: font, color: { argb: RUN_COLOR[s.color] } } })
    cursor = s.end
  }
  if (cursor < text.length) runs.push({ text: text.slice(cursor), font: { name: font } })
  return { richText: runs }
}

/** Rich text for the target cell (highlights on the target panel). */
export function buildTargetRichText(row: StringRow, font: string): { richText: RichRun[] } | string {
  return buildRichText(row.target, row.highlights.filter((h) => h.panel === 'target'), font)
}

/** Excel forbids : \ / ? * [ ] in sheet names and caps them at 31 chars. */
function safeSheetName(name: string, used: Set<string>): string {
  let base = (name || 'Sheet').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet'
  let candidate = base
  let n = 2
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n++})`
    candidate = base.slice(0, 31 - suffix.length) + suffix
  }
  used.add(candidate.toLowerCase())
  return candidate
}

/**
 * Export notes to a brand-new .xlsx via ExcelJS. One worksheet per submodule
 * (Open Decision #1 = grouped). Columns: Key, English, <LanguageName>, Romanized,
 * Notes. Flagged spans in the target cell render as colored rich text. Never
 * touches any input file; the only artifact this tool writes.
 */
export async function exportNotes(rows: StringRow[], sheetBaseName: string, activeCode: string): Promise<void> {
  const ExcelJS = (await import('exceljs')).default
  const profile = profileByCode(activeCode)
  const langName = profile?.name ?? activeCode.toUpperCase()
  const targetFont = profile?.font.replace(/'/g, '').split(',')[0].trim() || 'Noto Sans Devanagari'
  const bodyFont = 'Roboto Condensed'

  const wb = new ExcelJS.Workbook()

  // Preserve submodule order of first appearance.
  const groups = new Map<string, StringRow[]>()
  for (const row of rows) {
    const key = row.submodule || 'Review Notes'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  }

  const usedNames = new Set<string>()
  for (const [submodule, groupRows] of groups) {
    const ws = wb.addWorksheet(safeSheetName(submodule, usedNames))
    ws.columns = [
      { header: 'Key', width: 22 },
      { header: 'English', width: 36 },
      { header: langName, width: 36 },
      { header: 'Romanized', width: 36 },
      { header: 'Notes', width: 44 },
    ]

    // header row: black fill, white bold text
    const head = ws.getRow(1)
    head.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: bodyFont }
      cell.alignment = { wrapText: true, vertical: 'top' }
    })

    for (const row of groupRows) {
      const added = ws.addRow([
        row.key,
        row.english,
        buildTargetRichText(row, targetFont),
        buildRichText(row.roman, row.highlights.filter((h) => h.panel === 'roman'), bodyFont),
        buildNotesCell(row),
      ])
      added.eachCell((cell, col) => {
        cell.alignment = { wrapText: true, vertical: 'top' }
        // Rich-text cells carry per-run fonts; only plain-string cells need a cell font.
        // Column 3 is the target language (its font); everything else is the body font.
        if (typeof cell.value !== 'object') cell.font = { name: col === 3 ? targetFont : bodyFont }
      })
    }
  }

  if (!groups.size) wb.addWorksheet('Review Notes')

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `review_notes_${sheetBaseName}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseWorkbook, buildTargetRichText, buildRichText } from './spreadsheet'
import type { StringRow } from './types'

/** Build an in-memory .xlsx ArrayBuffer that mirrors the studio's real shape. */
function makeWorkbook(): ArrayBuffer {
  const wb = XLSX.utils.book_new()

  const sub00 = XLSX.utils.aoa_to_sheet([
    // note the inconsistent spacing: "Bangla(bn)" vs "Nepali (ne)"
    ['Key', 'Arabic(ar)', 'English(en)', 'Bangla(bn)', 'Nepali (ne)'],
    ['G001', 'مرحبا', 'Hello', 'হ্যালো', 'नमस्ते'],
    ['G002', '', 'World', '', 'संसार'],
  ])
  XLSX.utils.book_append_sheet(wb, sub00, 'Sub00 - Introduction')

  const sub01 = XLSX.utils.aoa_to_sheet([
    ['Key', 'English(en)', 'Bangla(bn)', 'Nepali (ne)'],
    ['G010', 'Eat', 'খাওয়া', 'खानु'],
  ])
  XLSX.utils.book_append_sheet(wb, sub01, 'Sub01 - Basics')

  // non-data tabs that must be skipped
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Overview', 'Count'], ['x', 1]]), 'Summary')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Note'], ['tbd']]), 'Arabic issues')

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

describe('parseWorkbook — multi-sheet, code-based extraction', () => {
  it('aggregates rows from every reviewable sheet, skips Summary/issue tabs', async () => {
    const { rows, warning } = await parseWorkbook(makeWorkbook(), 'ne')
    expect(warning).toBeUndefined()
    expect(rows.map((r) => r.key)).toEqual(['G001', 'G002', 'G010'])
  })

  it('matches the target column by ISO code tolerant of spacing (Nepali (ne))', async () => {
    const { rows } = await parseWorkbook(makeWorkbook(), 'ne')
    expect(rows[0].target).toBe('नमस्ते')
    expect(rows[2].target).toBe('खानु')
  })

  it('matches Bangla(bn) with no space and extracts only that language', async () => {
    const { rows } = await parseWorkbook(makeWorkbook(), 'bn')
    expect(rows[0].target).toBe('হ্যালো')
  })

  it('per-language extraction leaks no other language into memory (confidentiality)', async () => {
    const { rows } = await parseWorkbook(makeWorkbook(), 'ne')
    const blob = JSON.stringify(rows)
    expect(blob).not.toContain('হ্যালো') // bangla
    expect(blob).not.toContain('مرحبا') // arabic
    expect(blob).toContain('नमस्ते') // nepali present
  })

  it('tags each row with its source submodule', async () => {
    const { rows } = await parseWorkbook(makeWorkbook(), 'ne')
    expect(rows[0].submodule).toBe('Sub00 - Introduction')
    expect(rows[2].submodule).toBe('Sub01 - Basics')
  })

  it('reports the registry languages available in the workbook (ar is Phase 3, excluded)', async () => {
    const { workbookLangs } = await parseWorkbook(makeWorkbook(), 'ne')
    expect(workbookLangs).toEqual(['bn', 'ne'])
  })

  it('generates romanization for ne (has an engine) and leaves it empty for bn', async () => {
    const ne = await parseWorkbook(makeWorkbook(), 'ne')
    const bn = await parseWorkbook(makeWorkbook(), 'bn')
    expect(ne.rows[0].roman.length).toBeGreaterThan(0)
    expect(bn.rows[0].roman).toBe('')
  })

  it('warns when the active language column is absent', async () => {
    const { warning } = await parseWorkbook(makeWorkbook(), 'ta')
    expect(warning).toMatch(/Tamil/)
  })
})

describe('buildTargetRichText — WI-8 exact-span highlight runs', () => {
  const row = (target: string, highlights: StringRow['highlights']): StringRow => ({
    key: 'k',
    english: 'e',
    target,
    roman: '',
    transFromSheet: '',
    submodule: 's',
    highlights,
    rowFlags: [],
    seen: false,
    checked: false,
  })

  it('returns a plain string when there are no highlights', () => {
    expect(buildTargetRichText(row('hello world', []), 'Arial')).toBe('hello world')
  })

  it('splits the text into colored runs at highlight boundaries', () => {
    const r = row('hello world', [
      { id: 'h1', panel: 'target', start: 6, end: 11, text: 'world', comment: 'x', color: 'red' },
    ])
    const out = buildTargetRichText(r, 'Arial')
    expect(typeof out).toBe('object')
    if (typeof out === 'object') {
      expect(out.richText.map((x) => x.text)).toEqual(['hello ', 'world'])
      expect(out.richText[1].font.color?.argb).toBe('FFE74C3C')
    }
  })

  it('ignores highlights on the roman panel', () => {
    const r = row('hello', [
      { id: 'h1', panel: 'roman', start: 0, end: 5, text: 'hello', comment: 'x', color: 'orange' },
    ])
    expect(buildTargetRichText(r, 'Arial')).toBe('hello')
  })

  it('buildRichText colors romanized-panel spans too (export bug fix)', () => {
    const romanHls: StringRow['highlights'] = [
      { id: 'h1', panel: 'roman', start: 0, end: 5, text: 'lugaa', comment: 'x', color: 'orange' },
    ]
    const out = buildRichText('lugaa pherne', romanHls, 'Roboto')
    expect(typeof out).toBe('object')
    if (typeof out === 'object') {
      expect(out.richText.map((x) => x.text)).toEqual(['lugaa', ' pherne'])
      expect(out.richText[0].font.color?.argb).toBe('FFF39C12')
    }
  })
})

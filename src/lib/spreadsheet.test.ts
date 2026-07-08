import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseWorkbook, buildRichText, flattenTakesForExport } from './spreadsheet'
import type { Highlight } from './types'

/** Build an in-memory .xlsx ArrayBuffer that mirrors the studio's real shape. */
function makeWorkbook(): ArrayBuffer {
  const wb = XLSX.utils.book_new()

  const sub00 = XLSX.utils.aoa_to_sheet([
    // note the inconsistent spacing: "Bangla(bn)" vs "Nepali (ne)"
    ['Key', 'Arabic(ar)', 'English(en)', 'Bangla(bn)', 'Nepali (ne)'],
    ['G001', 'مرحبا', 'Hello', 'হ্যালো', 'नमस्ते'],
    // a KSA take of G001 — same base key with a _KSA suffix, its own Nepali text
    ['G001_KSA', 'مرحبا', 'Hello', '', 'नमस्ते (केएसए)'],
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
  it('aggregates one logical row per string, skips Summary/issue tabs', async () => {
    const { rows, warning } = await parseWorkbook(makeWorkbook(), 'ne')
    expect(warning).toBeUndefined()
    // G001_KSA folds into G001, so it is NOT a separate entry
    expect(rows.map((r) => r.key)).toEqual(['G001', 'G002', 'G010'])
  })

  it('matches the target column by ISO code tolerant of spacing (Nepali (ne))', async () => {
    const { rows } = await parseWorkbook(makeWorkbook(), 'ne')
    expect(rows[0].takes.base?.target).toBe('नमस्ते')
    expect(rows[2].takes.base?.target).toBe('खानु')
  })

  it('matches Bangla(bn) with no space and extracts only that language', async () => {
    const { rows } = await parseWorkbook(makeWorkbook(), 'bn')
    expect(rows[0].takes.base?.target).toBe('হ্যালো')
  })

  it('per-language extraction leaks no other language into memory (confidentiality)', async () => {
    const { rows } = await parseWorkbook(makeWorkbook(), 'ne')
    const blob = JSON.stringify(rows)
    expect(blob).not.toContain('হ্যালো') // bangla
    expect(blob).not.toContain('مرحبا') // arabic
    expect(blob).toContain('नमस्ते') // nepali present
  })

  it('folds a _KSA row into its base string as the ksa take', async () => {
    const { rows } = await parseWorkbook(makeWorkbook(), 'ne')
    const g001 = rows[0]
    expect(g001.takes.base?.target).toBe('नमस्ते')
    expect(g001.takes.ksa?.target).toBe('नमस्ते (केएसए)')
    expect(g001.takes.ksa?.key).toBe('G001_KSA') // full key retained for export
    expect(g001.takes.ksa?.roman.length).toBeGreaterThan(0) // KSA romanization generated
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
    expect(ne.rows[0].takes.base?.roman.length).toBeGreaterThan(0)
    expect(bn.rows[0].takes.base?.roman).toBe('')
  })

  it('warns when the active language column is absent', async () => {
    const { warning } = await parseWorkbook(makeWorkbook(), 'ta')
    expect(warning).toMatch(/Tamil/)
  })
})

describe('flattenTakesForExport — base and KSA as separate rows', () => {
  it('emits one row per take, base before ksa, with the take key restored', async () => {
    const { rows } = await parseWorkbook(makeWorkbook(), 'ne')
    const entries = flattenTakesForExport(rows)
    expect(entries.map((e) => e.key)).toEqual(['G001', 'G001_KSA', 'G002', 'G010'])
    const ksa = entries.find((e) => e.key === 'G001_KSA')!
    expect(ksa.target).toBe('नमस्ते (केएसए)')
    expect(ksa.submodule).toBe('Sub00 - Introduction')
  })
})

describe('buildRichText — WI-8 exact-span highlight runs', () => {
  const hl = (panel: 'target' | 'roman', start: number, end: number, color: 'orange' | 'red', text: string): Highlight => ({
    id: 'h1',
    panel,
    start,
    end,
    text,
    comment: 'x',
    color,
  })

  it('returns a plain string when there are no highlights', () => {
    expect(buildRichText('hello world', [], 'Arial')).toBe('hello world')
  })

  it('splits the text into colored runs at highlight boundaries', () => {
    const out = buildRichText('hello world', [hl('target', 6, 11, 'red', 'world')], 'Arial')
    expect(typeof out).toBe('object')
    if (typeof out === 'object') {
      expect(out.richText.map((x) => x.text)).toEqual(['hello ', 'world'])
      expect(out.richText[1].font.color?.argb).toBe('FFE74C3C')
    }
  })

  it('colors romanized-panel spans too (export bug fix)', () => {
    const out = buildRichText('lugaa pherne', [hl('roman', 0, 5, 'orange', 'lugaa')], 'Roboto')
    expect(typeof out).toBe('object')
    if (typeof out === 'object') {
      expect(out.richText.map((x) => x.text)).toEqual(['lugaa', ' pherne'])
      expect(out.richText[0].font.color?.argb).toBe('FFF39C12')
    }
  })
})

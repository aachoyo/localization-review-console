import { describe, it, expect } from 'vitest'
import { romanize } from './romanizer'

describe('romanize — PRD §8 acceptance cases', () => {
  const cases: Array<[string, string]> = [
    ['नमस्ते', 'namaste'],
    ['पानीले', 'paanile'],
    ['गर्नुहोस्', 'garnuhos'],
    ['स्वागत', 'swaagat'],
    ['ट्यावेलले', 'tyaawelale'],
    ['गर्ने', 'garne'],
    ['छ', 'chha'],
    ['सरसफाइ', 'sarasaphaai'],
    ['खानु', 'khaanu'],
    ['नमस्ते।', 'namaste.'],
  ]

  it.each(cases)('%s -> %s', (input, expected) => {
    expect(romanize(input)).toBe(expected)
  })
})

describe('romanize — pass-through & mixed content', () => {
  it('passes Latin text through unchanged', () => {
    expect(romanize('Level 2')).toBe('Level 2')
  })

  it('converts Devanagari digits to Latin', () => {
    expect(romanize('२०२६')).toBe('2026')
  })

  it('handles empty / nullish input', () => {
    expect(romanize('')).toBe('')
    expect(romanize(null)).toBe('')
    expect(romanize(undefined)).toBe('')
  })

  it('romanizes mixed Devanagari + Latin', () => {
    expect(romanize('नमस्ते World')).toBe('namaste World')
  })
})

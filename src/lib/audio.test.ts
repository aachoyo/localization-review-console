import { describe, it, expect } from 'vitest'
import { indexAudioFiles, matchAudio, variantsFor, langFoldersInIndex, type ScopedFile } from './audio'

const f = (name: string, langFolder: string): ScopedFile => ({
  file: new File(['x'], name, { type: 'audio/mpeg' }),
  langFolder,
})

describe('language-scoped audio index', () => {
  it('does not collide identical stems across NE / BN folders', () => {
    const idx = indexAudioFiles([f('Greeting.mp3', 'NE'), f('Greeting.mp3', 'BN')])
    const ne = matchAudio(idx, 'NE', 'Greeting')
    const bn = matchAudio(idx, 'BN', 'Greeting')
    expect(ne).not.toBeNull()
    expect(bn).not.toBeNull()
    expect(ne).not.toBe(bn) // different File objects, one per language
  })

  it('matchAudio returns null for a language not present', () => {
    const idx = indexAudioFiles([f('Greeting.mp3', 'NE')])
    expect(matchAudio(idx, 'BN', 'Greeting')).toBeNull()
  })

  it('ignores non-mp3 files (e.g. the sibling .mp3.meta)', () => {
    const idx = indexAudioFiles([f('Greeting.mp3', 'NE'), f('Greeting.mp3.meta', 'NE')])
    expect(idx.count).toBe(1)
  })

  it('folder-code lookup is case-insensitive', () => {
    const idx = indexAudioFiles([f('Greeting.mp3', 'NE')])
    expect(matchAudio(idx, 'ne', 'Greeting')).not.toBeNull()
  })

  it('_KSA variant does not overwrite the canonical base take', () => {
    const idx = indexAudioFiles([f('Greeting.mp3', 'NE'), f('Greeting_KSA.mp3', 'NE')])
    const base = matchAudio(idx, 'NE', 'Greeting', 'base')
    const ksa = matchAudio(idx, 'NE', 'Greeting', 'ksa')
    expect(base?.name).toBe('Greeting.mp3')
    expect(ksa?.name).toBe('Greeting_KSA.mp3')
    expect(variantsFor(idx, 'NE', 'Greeting')).toEqual(['base', 'ksa'])
  })

  it('an absent variant falls back to base', () => {
    const idx = indexAudioFiles([f('Greeting.mp3', 'NE')])
    expect(matchAudio(idx, 'NE', 'Greeting', 'ksa')?.name).toBe('Greeting.mp3')
  })

  it('exposes the language folders present', () => {
    const idx = indexAudioFiles([f('a.mp3', 'NE'), f('b.mp3', 'BN')])
    expect(langFoldersInIndex(idx).sort()).toEqual(['BN', 'NE'])
  })
})

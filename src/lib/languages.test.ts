import { describe, it, expect } from 'vitest'
import { LANGUAGES, profileByCode, profileByFolder } from './languages'

describe('language registry', () => {
  it('exposes the five in-scope languages', () => {
    expect(Object.keys(LANGUAGES).sort()).toEqual(['bn', 'hi', 'ml', 'ne', 'ta'])
  })

  it('profileByCode returns the right display name', () => {
    expect(profileByCode('bn')?.name).toBe('Bengali')
    expect(profileByCode('ne')?.name).toBe('Nepali')
  })

  it('profileByCode is tolerant of case/whitespace', () => {
    expect(profileByCode(' NE ')?.code).toBe('ne')
  })

  it('profileByFolder round-trips (case-insensitive)', () => {
    expect(profileByFolder('ne')?.code).toBe('ne')
    expect(profileByFolder('BN')?.code).toBe('bn')
  })

  it('ne/hi have a romanize engine; bn/ta/ml do not', () => {
    expect(typeof profileByCode('ne')?.romanize).toBe('function')
    expect(typeof profileByCode('hi')?.romanize).toBe('function')
    expect(profileByCode('bn')?.romanize).toBeUndefined()
    expect(profileByCode('ta')?.romanize).toBeUndefined()
    expect(profileByCode('ml')?.romanize).toBeUndefined()
  })

  it('unknown codes return undefined', () => {
    expect(profileByCode('xx')).toBeUndefined()
    expect(profileByFolder('ZZ')).toBeUndefined()
  })
})

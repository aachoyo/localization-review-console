/**
 * Devanagari -> plain phonetic Latin (Nepali style).
 *
 * Ported verbatim (behavior-preserving) from the validated reference engine.
 * NOT IAST: no dots/macrons. Produces e.g. namaste, paanile, garnuhos, swaagat.
 * See the project PRD §8 for the specification and acceptance examples.
 */

const INDEP: Record<string, string> = {
  अ: 'a', आ: 'aa', इ: 'i', ई: 'i', उ: 'u', ऊ: 'u', ऋ: 'ri',
  ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au',
  ऎ: 'e', ऒ: 'o', ऍ: 'e', ऑ: 'o', ॠ: 'ri', ऌ: 'li',
}

const CONSONANTS: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'ng',
  च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'ny',
  ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n',
  त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
  प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm',
  य: 'y', र: 'r', ल: 'l', व: 'w', ळ: 'l',
  श: 'sh', ष: 'sh', स: 's', ह: 'h',
}

/** Special conjuncts (consonant + virama + consonant), checked before generic. */
const SPECIAL: Record<string, string> = { 'क्ष': 'chh', 'त्र': 'tr', 'ज्ञ': 'gya', 'श्र': 'shr' }

/** Base consonant + nukta sign -> sound */
const NUKTA_BASE: Record<string, string> = { ड: 'r', ढ: 'rh', फ: 'f', ज: 'z', क: 'k', ख: 'kh', ग: 'g' }

/** Precomposed nukta consonants */
const NUKTA_PRE: Record<string, string> = {
  'क़': 'k', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f', 'य़': 'y',
}

const MATRAS: Record<string, string> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ॅ': 'e', 'ॉ': 'o', 'ॆ': 'e', 'ॊ': 'o', 'ॄ': 'ri',
}

const VIRAMA = '्'
const ANUSVARA = 'ं'
const CHANDRABINDU = 'ँ'
const VISARGA = 'ः'
const NUKTA_SIGN = '़'

interface Unit {
  base: string
  vowel: string
  inherent: boolean
  suffix: string
}

/** Transliterate a run of pure Devanagari letters (a single "word"). */
export function romanizeWord(w: string): string {
  const units: Unit[] = []
  let i = 0
  while (i < w.length) {
    const three = w.substr(i, 3)
    if (SPECIAL[three] !== undefined) {
      units.push({ base: SPECIAL[three], vowel: 'a', inherent: true, suffix: '' })
      i += 3
      continue
    }
    const ch = w[i]
    if (NUKTA_PRE[ch] !== undefined) {
      units.push({ base: NUKTA_PRE[ch], vowel: 'a', inherent: true, suffix: '' })
      i++
      continue
    }
    if (CONSONANTS[ch] !== undefined) {
      let base = CONSONANTS[ch]
      if (w[i + 1] === NUKTA_SIGN) {
        if (NUKTA_BASE[ch] !== undefined) base = NUKTA_BASE[ch]
        i++
      }
      units.push({ base, vowel: 'a', inherent: true, suffix: '' })
      i++
      continue
    }
    if (INDEP[ch] !== undefined) {
      units.push({ base: '', vowel: INDEP[ch], inherent: false, suffix: '' })
      i++
      continue
    }
    if (MATRAS[ch] !== undefined) {
      if (units.length) {
        const u = units[units.length - 1]
        u.vowel = MATRAS[ch]
        u.inherent = false
      }
      i++
      continue
    }
    if (ch === VIRAMA) {
      if (units.length) {
        const u = units[units.length - 1]
        u.vowel = ''
        u.inherent = false
      }
      i++
      continue
    }
    if (ch === ANUSVARA || ch === CHANDRABINDU) {
      if (units.length) units[units.length - 1].suffix += 'n'
      else units.push({ base: '', vowel: '', inherent: false, suffix: 'n' })
      i++
      continue
    }
    if (ch === VISARGA) {
      if (units.length) units[units.length - 1].suffix += 'h'
      i++
      continue
    }
    if (ch === NUKTA_SIGN) {
      i++
      continue
    }
    i++ // unknown devanagari mark: skip
  }

  // Schwa deletion: drop inherent 'a' on the final consonant of the word only.
  // Exception: keep it on single-unit (monosyllabic) words, e.g. छ -> chha, न -> na.
  if (units.length > 1) {
    const last = units[units.length - 1]
    if (last.base !== '' && last.inherent && last.vowel === 'a') last.vowel = ''
  }

  return units.map((u) => u.base + u.vowel + u.suffix).join('')
}

/**
 * Romanize arbitrary text: Devanagari runs are transliterated word-by-word;
 * Devanagari digits become Latin digits, danda ।/॥ becomes '.', and everything
 * else (Latin, punctuation, spaces) passes through unchanged.
 */
export function romanize(text: string | null | undefined): string {
  if (!text) return ''
  let out = ''
  let run = ''
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0)!
    const isLetter =
      cp >= 0x0900 && cp <= 0x097f && !(cp >= 0x0964 && cp <= 0x0965) && !(cp >= 0x0966 && cp <= 0x096f)
    if (isLetter) {
      run += ch
    } else {
      if (run) {
        out += romanizeWord(run)
        run = ''
      }
      if (cp >= 0x0966 && cp <= 0x096f) out += String(cp - 0x0966) // Devanagari digits
      else if (cp === 0x0964 || cp === 0x0965) out += '.' // danda / double danda
      else out += ch // pass through everything else
    }
  }
  if (run) out += romanizeWord(run)
  return out
}

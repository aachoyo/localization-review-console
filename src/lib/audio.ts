export type AudioVariant = 'base' | 'ksa' | 'retail'

export interface KeyTakes {
  base?: File
  ksa?: File
  retail?: File
}

/**
 * Language-scoped audio index. The SAME filename stem exists in every language
 * folder (NE/BN/EN/…), so a flat index would silently return the wrong language.
 * We key first by UPPER folder code, then by string Key, to the available takes.
 */
export interface AudioIndex {
  /** folderCodeUpper -> (Key -> takes) */
  byLang: Map<string, Map<string, KeyTakes>>
  /** lowercase-Key fallback per language */
  byLangLC: Map<string, Map<string, KeyTakes>>
  count: number
}

/** A file paired with the top-level language subfolder it was found under. */
export interface ScopedFile {
  file: File
  /** immediate child-of-root directory name that is the language code, e.g. 'NE' */
  langFolder: string
}

const stemOf = (name: string) => name.replace(/\.[^.]+$/, '')

/**
 * Classify a clip's language folder and variant from its path + name.
 *
 * - `langFolder` is the language-code segment (NE/BN/…) in the path when present.
 * - `_KSA` suffix on the stem -> ksa variant.
 * - a `…Retail…` segment anywhere in the path -> retail variant.
 *
 * Returns the canonical Key (stem with any `_KSA` suffix stripped).
 */
function classify(scoped: ScopedFile): { lang: string; key: string; variant: AudioVariant } {
  const stem = stemOf(scoped.file.name)
  const isKsa = /_KSA$/i.test(stem)
  const key = isKsa ? stem.replace(/_KSA$/i, '') : stem
  const path = ((scoped.file as File & { webkitRelativePath?: string }).webkitRelativePath || '').toLowerCase()
  const isRetail = /retail/.test(path) || /retail/.test((scoped.langFolder || '').toLowerCase())
  const variant: AudioVariant = isKsa ? 'ksa' : isRetail ? 'retail' : 'base'
  return { lang: scoped.langFolder.toUpperCase(), key, variant }
}

/**
 * Build the nested, language-scoped index from scoped files. Later files never
 * overwrite an existing take of the same (lang, key, variant) — the first wins,
 * mirroring the old stem index's stability.
 */
export function indexAudioFiles(files: ScopedFile[]): AudioIndex {
  const byLang = new Map<string, Map<string, KeyTakes>>()
  const byLangLC = new Map<string, Map<string, KeyTakes>>()
  let count = 0

  for (const scoped of files) {
    if (!/\.mp3$/i.test(scoped.file.name)) continue // ignores the sibling .mp3.meta files
    const { lang, key, variant } = classify(scoped)
    if (!lang) continue

    if (!byLang.has(lang)) byLang.set(lang, new Map())
    if (!byLangLC.has(lang)) byLangLC.set(lang, new Map())
    const langMap = byLang.get(lang)!
    const langMapLC = byLangLC.get(lang)!

    if (!langMap.has(key)) langMap.set(key, {})
    if (!langMapLC.has(key.toLowerCase())) langMapLC.set(key.toLowerCase(), {})
    const takes = langMap.get(key)!
    const takesLC = langMapLC.get(key.toLowerCase())!

    if (!takes[variant]) takes[variant] = scoped.file
    if (!takesLC[variant]) takesLC[variant] = scoped.file
    count++
  }

  return { byLang, byLangLC, count }
}

/** All variants present for a (lang, key), in display order. */
export function variantsFor(index: AudioIndex | null, langFolderCode: string, key: string): AudioVariant[] {
  const takes = takesFor(index, langFolderCode, key)
  if (!takes) return []
  return (['base', 'ksa', 'retail'] as AudioVariant[]).filter((v) => takes[v])
}

function takesFor(index: AudioIndex | null, langFolderCode: string, key: string): KeyTakes | null {
  if (!index || !langFolderCode || !key) return null
  const lang = langFolderCode.toUpperCase()
  const langMap = index.byLang.get(lang)
  const langMapLC = index.byLangLC.get(lang)
  return langMap?.get(key) ?? langMapLC?.get(key.toLowerCase()) ?? null
}

/**
 * Match a string Key to a clip within the active language only, for the requested
 * variant. Falls back to the base take if the requested variant is absent.
 */
export function matchAudio(
  index: AudioIndex | null,
  langFolderCode: string,
  key: string,
  variant: AudioVariant = 'base',
): File | null {
  const takes = takesFor(index, langFolderCode, key)
  if (!takes) return null
  return takes[variant] ?? takes.base ?? null
}

/** Language folder codes actually present in the index (UPPER). */
export function langFoldersInIndex(index: AudioIndex | null): string[] {
  return index ? [...index.byLang.keys()] : []
}

/**
 * Recursively read all files from dropped DataTransfer entries (folder drop),
 * capturing each file's top-level (child-of-root) directory as its language
 * folder. Uses the webkitGetAsEntry API (Chrome/Edge).
 */
export async function readDroppedEntries(items: DataTransferItem[]): Promise<ScopedFile[]> {
  const entries = items
    .map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
    .filter(Boolean) as FileSystemEntry[]
  const out: ScopedFile[] = []
  for (const entry of entries) await readEntry(entry, out, [])
  return out
}

async function readEntry(entry: FileSystemEntry, out: ScopedFile[], parents: string[]): Promise<void> {
  if (entry.isFile) {
    await new Promise<void>((res) =>
      (entry as FileSystemFileEntry).file(
        (f) => {
          out.push({ file: f, langFolder: langFolderFromParents(parents) })
          res()
        },
        () => res(),
      ),
    )
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    let batch: FileSystemEntry[]
    do {
      batch = await new Promise<FileSystemEntry[]>((res) =>
        reader.readEntries(
          (e) => res(e),
          () => res([]),
        ),
      )
      for (const e of batch) await readEntry(e, out, [...parents, entry.name])
    } while (batch.length)
  }
}

// A language folder is a path segment that is a 2–4 letter code (NE/BN/TAG/…),
// which is how the studio names them. Pick the deepest such segment so the main
// (…_VOAudio/NE/) and Retail (…_VO_RetailAudio/NE/) trees both resolve to NE.
function langFolderFromParents(parents: string[]): string {
  for (let i = parents.length - 1; i >= 0; i--) {
    if (/^[A-Za-z]{2,4}$/.test(parents[i])) return parents[i]
  }
  return parents[parents.length - 1] ?? ''
}

/**
 * Wrap an <input webkitdirectory> FileList as ScopedFiles, deriving the language
 * folder from each file's webkitRelativePath (the picker keeps the tree there).
 */
export function scopeFileList(files: File[]): ScopedFile[] {
  return files.map((file) => {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || ''
    const segs = rel.split('/').slice(0, -1) // drop the filename
    return { file, langFolder: langFolderFromParents(segs) }
  })
}

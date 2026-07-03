export interface AudioIndex {
  byStem: Map<string, File>
  byStemLC: Map<string, File>
  count: number
}

const stemOf = (name: string) => name.replace(/\.[^.]+$/, '')

/**
 * Index every .mp3 found in the file list by filename stem.
 * Exact-stem match is primary; a lowercase map provides a graceful fallback.
 */
export function indexAudioFiles(files: File[]): AudioIndex {
  const byStem = new Map<string, File>()
  const byStemLC = new Map<string, File>()
  let count = 0
  for (const f of files) {
    if (!/\.mp3$/i.test(f.name)) continue
    const stem = stemOf(f.name)
    if (!byStem.has(stem)) byStem.set(stem, f)
    byStemLC.set(stem.toLowerCase(), f)
    count++
  }
  return { byStem, byStemLC, count }
}

/** Match a string key to a clip: exact stem first, case-insensitive fallback. */
export function matchAudio(index: AudioIndex | null, key: string): File | null {
  if (!index || !key) return null
  return index.byStem.get(key) ?? index.byStemLC.get(key.toLowerCase()) ?? null
}

/**
 * Recursively read all files from dropped DataTransfer entries (folder drop).
 * Uses the webkitGetAsEntry API (Chrome/Edge).
 */
export async function readDroppedEntries(items: DataTransferItem[]): Promise<File[]> {
  const entries = items
    .map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
    .filter(Boolean) as FileSystemEntry[]
  const out: File[] = []
  for (const entry of entries) await readEntry(entry, out)
  return out
}

async function readEntry(entry: FileSystemEntry, out: File[]): Promise<void> {
  if (entry.isFile) {
    await new Promise<void>((res) =>
      (entry as FileSystemFileEntry).file(
        (f) => {
          out.push(f)
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
      for (const e of batch) await readEntry(e, out)
    } while (batch.length)
  }
}

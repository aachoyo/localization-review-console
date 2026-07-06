import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { StringView } from '@/components/StringView'
import { AudioBar } from '@/components/AudioBar'
import { Toolbar } from '@/components/Toolbar'
import { Welcome } from '@/components/Welcome'
import { NotePopover, type NoteDraft } from '@/components/NotePopover'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useReviewStore } from '@/store/useReviewStore'
import { useKeyboard } from '@/hooks/useKeyboard'
import type { SelectionSpan } from '@/hooks/useTextSelection'
import { matchAudio, indexAudioFiles, readDroppedEntries, variantsFor } from '@/lib/audio'
import { profileByCode } from '@/lib/languages'
import type { PanelName } from '@/lib/types'

export default function App() {
  const strings = useReviewStore((s) => s.strings)
  const cursor = useReviewStore((s) => s.cursor)
  const audio = useReviewStore((s) => s.audio)
  const activeLang = useReviewStore((s) => s.activeLang)
  const activeVariant = useReviewStore((s) => s.activeVariant)
  const setActiveVariant = useReviewStore((s) => s.setActiveVariant)
  const noteAudioMode = useReviewStore((s) => s.noteAudioMode)
  const setAudio = useReviewStore((s) => s.setAudio)
  const addHighlight = useReviewStore((s) => s.addHighlight)
  const updateHighlight = useReviewStore((s) => s.updateHighlight)
  const addRowFlag = useReviewStore((s) => s.addRowFlag)
  const loadWorkbook = useReviewStore((s) => s.loadWorkbook)
  const row = strings[cursor] ?? null

  const folderCode = profileByCode(activeLang)?.folderCode ?? activeLang.toUpperCase()

  // ---- audio ----
  const audioRef = useRef<HTMLAudioElement>(null)
  // Memoize on the stable key (not the row object): adding a highlight replaces the
  // row object, but the matched File reference is unchanged, so the [file] effect
  // below won't reload/reset the element mid-note (WI-7).
  const file = useMemo(
    () => (row ? matchAudio(audio, folderCode, row.key, activeVariant) : null),
    [audio, folderCode, row?.key, activeVariant],
  )
  const variants = useMemo(
    () => (row ? variantsFor(audio, folderCode, row.key) : []),
    [audio, folderCode, row?.key],
  )

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    if (file) {
      const url = URL.createObjectURL(file)
      el.src = url
      return () => URL.revokeObjectURL(url)
    }
    el.removeAttribute('src')
    el.load()
  }, [file])

  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el || !el.src) return
    if (el.paused) {
      if (el.duration && el.currentTime >= el.duration) el.currentTime = 0 // restart if at end
      void el.play()
    } else el.pause()
  }, [])

  const replay = useCallback(() => {
    const el = audioRef.current
    if (!el || !el.src) return
    el.currentTime = 0
    void el.play()
  }, [])

  // ---- note editor ----
  const [draft, setDraft] = useState<NoteDraft | null>(null)
  const [flagText, setFlagText] = useState<string | null>(null) // null = closed
  const editorOpen = draft !== null || flagText !== null

  // WI-7: audio continuity across note-taking. Never resets currentTime.
  const wasPlayingRef = useRef(false)
  const prevEditorOpen = useRef(false)
  useEffect(() => {
    const el = audioRef.current
    if (el) {
      if (editorOpen && !prevEditorOpen.current) {
        wasPlayingRef.current = !el.paused
        if (noteAudioMode === 'pause-resume' && !el.paused) el.pause()
      } else if (!editorOpen && prevEditorOpen.current) {
        if (noteAudioMode === 'pause-resume' && wasPlayingRef.current && el.src) void el.play()
        wasPlayingRef.current = false
      }
    }
    prevEditorOpen.current = editorOpen
  }, [editorOpen, noteAudioMode])

  const onSelectSpan = useCallback((panel: PanelName, span: SelectionSpan) => {
    setDraft({
      mode: 'new',
      panel,
      start: span.start,
      end: span.end,
      text: span.text,
      comment: '',
      color: 'orange',
      anchor: { left: span.rect.left, top: span.rect.top, bottom: span.rect.bottom },
    })
  }, [])

  const onEditHighlight = useCallback(
    (id: string, rect: DOMRect) => {
      const h = row?.highlights.find((x) => x.id === id)
      if (!h) return
      setDraft({
        mode: 'edit',
        id,
        panel: h.panel,
        start: h.start,
        end: h.end,
        text: h.text,
        comment: h.comment,
        color: h.color,
        anchor: { left: rect.left, top: rect.top, bottom: rect.bottom },
      })
    },
    [row],
  )

  const saveNote = useCallback(() => {
    if (!draft) return
    const comment = draft.comment.trim()
    if (!comment) {
      toast.warning('Type a comment first')
      return
    }
    if (draft.mode === 'edit' && draft.id) {
      updateHighlight(draft.id, { comment, color: draft.color })
    } else {
      addHighlight({
        panel: draft.panel,
        start: draft.start,
        end: draft.end,
        text: draft.text,
        comment,
        color: draft.color,
      })
    }
    setDraft(null)
    window.getSelection()?.removeAllRanges()
  }, [draft, addHighlight, updateHighlight])

  // close the note popover when clicking outside it (it stops propagation itself)
  useEffect(() => {
    if (!draft) return
    const onDown = () => setDraft(null)
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [draft])

  // ---- keyboard ----
  useKeyboard({ noteOpen: editorOpen, onTogglePlay: togglePlay })

  // ---- folder drag-drop ----
  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!e.dataTransfer?.items?.length) return
      e.preventDefault()
      const items = [...e.dataTransfer.items]
      const scoped = await readDroppedEntries(items)

      // Route a dropped .xlsx to the workbook loader (same path as the Load button)
      const xlsx = scoped.find((s) => s.file.name.toLowerCase().endsWith('.xlsx'))
      if (xlsx) {
        const baseName = xlsx.file.name.replace(/\.[^.]+$/, '')
        try {
          const warning = await loadWorkbook(await xlsx.file.arrayBuffer(), baseName)
          if (warning) toast.warning(warning)
          const count = useReviewStore.getState().strings.length
          if (!count) toast.error('No populated rows found in the workbook.')
          else toast.success(`Loaded ${count} strings`)
        } catch (err) {
          toast.error('Could not read the spreadsheet: ' + (err as Error).message)
        }
      }

      // Everything else is treated as audio (language folders preserved)
      const audioFiles = scoped.filter((s) => !s.file.name.toLowerCase().endsWith('.xlsx'))
      if (audioFiles.length) {
        const index = indexAudioFiles(audioFiles)
        setAudio(index)
        toast.success(`${index.count} audio clips indexed`)
      }
    },
    [setAudio, loadWorkbook],
  )

  const loaded = strings.length > 0

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />

      <main className="flex min-h-0 flex-1">
        {loaded && <Sidebar />}

        <section
          className="flex min-w-0 flex-1 flex-col"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          {!loaded && <Welcome />}

          {loaded && row && (
            <>
              <div className="flex-1 overflow-y-auto px-7 pb-6 pt-5">
                <StringView
                  row={row}
                  index={cursor}
                  total={strings.length}
                  onSelectSpan={onSelectSpan}
                  onEditHighlight={onEditHighlight}
                />
              </div>
              <AudioBar
                ref={audioRef}
                fileName={file?.name ?? null}
                onReplay={replay}
                variants={variants}
                activeVariant={activeVariant}
                onVariant={setActiveVariant}
              />
              <Toolbar onFlagRow={() => setFlagText('')} />
            </>
          )}
        </section>
      </main>

      {draft && (
        <NotePopover
          draft={draft}
          onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
          onSave={saveNote}
          onCancel={() => setDraft(null)}
        />
      )}

      {flagText !== null && (
        <FlagDialog
          value={flagText}
          onChange={setFlagText}
          onCancel={() => setFlagText(null)}
          onSave={() => {
            const c = flagText.trim()
            if (c) addRowFlag(c)
            setFlagText(null)
          }}
        />
      )}

      <Toaster theme="light" position="bottom-center" richColors />
    </div>
  )
}

function FlagDialog({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={onCancel}
    >
      <div
        className="w-[420px] max-w-[90vw] rounded-xl border border-primary bg-popover p-4 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 text-sm font-medium">🚩 Flag this whole row</div>
        <div className="mb-2 text-xs text-muted-foreground">
          For issues that aren’t a specific span (e.g. “inconsistent narrator voice”).
        </div>
        <Textarea
          autoFocus
          value={value}
          placeholder="Describe the issue…"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSave()
            if (e.key === 'Escape') onCancel()
          }}
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave}>
            Add flag
          </Button>
        </div>
      </div>
    </div>
  )
}

import { useRef } from 'react'
import { toast } from 'sonner'
import { FileSpreadsheet, FolderOpen, Download, Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useReviewStore } from '@/store/useReviewStore'
import { exportNotes } from '@/lib/spreadsheet'
import { indexAudioFiles, scopeFileList } from '@/lib/audio'
import { LANGUAGES, profileByCode } from '@/lib/languages'
import { LangSelect } from '@/components/LangSelect'

export function Header() {
  const xlsxRef = useRef<HTMLInputElement>(null)

  const strings = useReviewStore((s) => s.strings)
  const audio = useReviewStore((s) => s.audio)
  const sheetBaseName = useReviewStore((s) => s.sheetBaseName)
  const activeLang = useReviewStore((s) => s.activeLang)
  const availableLangs = useReviewStore((s) => s.availableLangs)
  const showRomanization = useReviewStore((s) => s.showRomanization)
  const noteAudioMode = useReviewStore((s) => s.noteAudioMode)
  const loadWorkbook = useReviewStore((s) => s.loadWorkbook)
  const setAudio = useReviewStore((s) => s.setAudio)
  const setActiveLang = useReviewStore((s) => s.setActiveLang)
  const setShowRomanization = useReviewStore((s) => s.setShowRomanization)
  const setNoteAudioMode = useReviewStore((s) => s.setNoteAudioMode)

  // Options: languages actually present in loaded audio, else the full registry
  // (lets a reviewer pre-select before audio is dropped).
  const langOptions = availableLangs.length ? availableLangs : Object.keys(LANGUAGES)
  const romanizeSupported = !!profileByCode(activeLang)?.romanize

  async function onXlsx(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const baseName = f.name.replace(/\.[^.]+$/, '')
    try {
      const warning = await loadWorkbook(await f.arrayBuffer(), baseName)
      if (warning) toast.warning(warning)
      const count = useReviewStore.getState().strings.length
      if (!count) toast.error('No populated rows found in the workbook.')
      else toast.success(`Loaded ${count} strings`)
    } catch (err) {
      toast.error('Could not read the spreadsheet: ' + (err as Error).message)
    } finally {
      e.target.value = '' // allow re-loading the same file
    }
  }

  function onAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? [...e.target.files] : []
    const index = indexAudioFiles(scopeFileList(files))
    setAudio(index)
    toast.success(`${index.count} audio clips indexed`)
    e.target.value = ''
  }

  return (
    <header className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-border bg-[#f8fafc] px-4 py-2.5">
      <h1 className="whitespace-nowrap text-[15px] font-semibold">Localization Review Console</h1>

      {/* language selector */}
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Languages className="size-4" />
        <LangSelect value={activeLang} options={langOptions} onChange={(c) => void setActiveLang(c)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input ref={xlsxRef} type="file" accept=".xlsx" className="hidden" onChange={onXlsx} />
        <Button variant="secondary" size="sm" onClick={() => xlsxRef.current?.click()}>
          <FileSpreadsheet /> Load review sheet
        </Button>
        <Badge variant={strings.length ? 'ok' : 'default'}>
          {strings.length ? `${strings.length} strings` : 'no sheet'}
        </Badge>

        <input
          ref={(el) => {
            // webkitdirectory isn't in React's typed attributes
            if (el) {
              el.setAttribute('webkitdirectory', '')
              el.setAttribute('directory', '')
            }
          }}
          type="file"
          multiple
          className="hidden"
          onChange={onAudio}
          id="audio-input"
        />
        <Button variant="secondary" size="sm" onClick={() => document.getElementById('audio-input')?.click()}>
          <FolderOpen /> Load audio folder
        </Button>
        <Badge variant={audio?.count ? 'ok' : 'default'}>
          {audio?.count ? `${audio.count} clips` : 'no audio'}
        </Badge>
      </div>

      {/* reviewer preferences */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          title={romanizeSupported ? 'Toggle the romanization panel' : 'No romanization for this language'}
          disabled={!romanizeSupported}
          onClick={() => setShowRomanization(!showRomanization)}
        >
          Romanize: {showRomanization && romanizeSupported ? 'On' : 'Off'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          title="How audio behaves when you open a note"
          onClick={() => setNoteAudioMode(noteAudioMode === 'pause-resume' ? 'keep-playing' : 'pause-resume')}
        >
          Note audio: {noteAudioMode === 'pause-resume' ? 'Pause & resume' : 'Keep playing'}
        </Button>
      </div>

      <div className="flex-1" />

      <Button
        size="sm"
        disabled={!strings.length}
        onClick={async () => {
          try {
            await exportNotes(strings, sheetBaseName, activeLang)
            toast.success(`Exported review_notes_${sheetBaseName}.xlsx`)
          } catch (err) {
            toast.error('Export failed: ' + (err as Error).message)
          }
        }}
      >
        <Download /> Export notes
      </Button>
    </header>
  )
}

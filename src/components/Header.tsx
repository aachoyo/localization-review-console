import { useRef } from 'react'
import { toast } from 'sonner'
import { FileSpreadsheet, FolderOpen, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useReviewStore } from '@/store/useReviewStore'
import { parseWorkbook, exportNotes } from '@/lib/spreadsheet'
import { indexAudioFiles } from '@/lib/audio'

export function Header() {
  const xlsxRef = useRef<HTMLInputElement>(null)

  const strings = useReviewStore((s) => s.strings)
  const audio = useReviewStore((s) => s.audio)
  const sheetBaseName = useReviewStore((s) => s.sheetBaseName)
  const loadStrings = useReviewStore((s) => s.loadStrings)
  const setAudio = useReviewStore((s) => s.setAudio)

  async function onXlsx(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const baseName = f.name.replace(/\.[^.]+$/, '')
    try {
      const { rows, warning } = await parseWorkbook(await f.arrayBuffer())
      if (warning) toast.warning(warning)
      if (!rows.length) {
        toast.error('No populated rows found in the sheet.')
        return
      }
      loadStrings(rows, baseName)
      toast.success(`Loaded ${rows.length} strings`)
    } catch (err) {
      toast.error('Could not read the spreadsheet: ' + (err as Error).message)
    } finally {
      e.target.value = '' // allow re-loading the same file
    }
  }

  function onAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? [...e.target.files] : []
    const index = indexAudioFiles(files)
    setAudio(index)
    toast.success(`${index.count} audio clips indexed`)
    e.target.value = ''
  }

  return (
    <header className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-border bg-[#12141a] px-4 py-2.5">
      <h1 className="whitespace-nowrap text-[15px] font-semibold">Nepali &amp; Hindi Localization Review Console</h1>
      <span className="whitespace-nowrap text-xs italic text-muted-foreground">more lang coming soon :D</span>

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

      <div className="flex-1" />

      <Button
        size="sm"
        disabled={!strings.length}
        onClick={async () => {
          try {
            await exportNotes(strings, sheetBaseName)
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

import { forwardRef } from 'react'
import { SkipBack, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  fileName: string | null
  onReplay: () => void
}

/** Pinned audio bar. Shows a clear "no audio" state when a key is unmatched. */
export const AudioBar = forwardRef<HTMLAudioElement, Props>(({ fileName, onReplay }, ref) => {
  const hasAudio = !!fileName
  return (
    <div className="flex flex-shrink-0 items-center gap-3.5 border-t border-border bg-[#12141a] px-4 py-2.5">
      <Button variant="ghost" size="icon" title="Replay from start" onClick={onReplay} disabled={!hasAudio}>
        <SkipBack />
      </Button>

      {/* audio element is always mounted; src is toggled by the parent */}
      <audio ref={ref} controls preload="auto" className={hasAudio ? 'min-w-0 flex-1' : 'hidden'} />

      {!hasAudio && (
        <span className="flex items-center gap-2 font-semibold text-status-warn">
          <AlertTriangle className="size-4" /> No audio found for this key
        </span>
      )}

      {hasAudio && (
        <span className="max-w-[320px] truncate font-mono text-xs text-muted-foreground" title={fileName}>
          {fileName}
        </span>
      )}
    </div>
  )
})
AudioBar.displayName = 'AudioBar'

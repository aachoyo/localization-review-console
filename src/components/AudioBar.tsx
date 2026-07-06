import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { SkipBack, Play, Pause, Volume2, VolumeX, AlertTriangle } from 'lucide-react'
import type { AudioVariant } from '@/lib/audio'
import { cn } from '@/lib/utils'

interface Props {
  fileName: string | null
  onReplay: () => void
  variants: AudioVariant[]
  activeVariant: AudioVariant
  onVariant: (v: AudioVariant) => void
}

const VARIANT_LABEL: Record<AudioVariant, string> = { base: 'Base', ksa: 'KSA', retail: 'Retail' }
const SPEEDS = [0.75, 1, 1.25, 1.5]

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${m}:${ss.toString().padStart(2, '0')}`
}

/**
 * Spotify-style transport bar. The real <audio> element stays mounted (hidden)
 * and is driven programmatically; this UI replaces its native controls. Playback
 * state is local and event-synced, so the parent's keyboard controls stay in sync.
 */
export const AudioBar = forwardRef<HTMLAudioElement, Props>(
  ({ fileName, onReplay, variants, activeVariant, onVariant }, forwardedRef) => {
    const [el, setEl] = useState<HTMLAudioElement | null>(null)
    const [playing, setPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [rate, setRate] = useState(1)
    const [volume, setVolume] = useState(1)
    const [muted, setMuted] = useState(false)

    const trackRef = useRef<HTMLDivElement>(null)
    const volRef = useRef<HTMLDivElement>(null)

    // Merge the forwarded ref with our local element state.
    const setRef = useCallback(
      (node: HTMLAudioElement | null) => {
        setEl(node)
        if (typeof forwardedRef === 'function') forwardedRef(node)
        else if (forwardedRef) forwardedRef.current = node
      },
      [forwardedRef],
    )

    // Sync local state from the element's events.
    useEffect(() => {
      if (!el) return
      const onPlay = () => setPlaying(true)
      const onPause = () => setPlaying(false)
      const onTime = () => setCurrentTime(el.currentTime)
      const onMeta = () => {
        setDuration(el.duration || 0)
        el.playbackRate = rate
        el.volume = volume
        el.muted = muted
      }
      el.addEventListener('play', onPlay)
      el.addEventListener('pause', onPause)
      el.addEventListener('timeupdate', onTime)
      el.addEventListener('loadedmetadata', onMeta)
      el.addEventListener('durationchange', onMeta)
      return () => {
        el.removeEventListener('play', onPlay)
        el.removeEventListener('pause', onPause)
        el.removeEventListener('timeupdate', onTime)
        el.removeEventListener('loadedmetadata', onMeta)
        el.removeEventListener('durationchange', onMeta)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [el])

    useEffect(() => {
      if (el) el.playbackRate = rate
    }, [el, rate])
    useEffect(() => {
      if (el) {
        el.volume = volume
        el.muted = muted
      }
    }, [el, volume, muted])

    // A new clip resets the transport display (the element's src is set by the parent).
    useEffect(() => {
      setCurrentTime(0)
      setDuration(0)
      setPlaying(false)
    }, [fileName])

    const hasAudio = !!fileName
    const frac = duration > 0 ? currentTime / duration : 0
    const effVol = muted ? 0 : volume

    const togglePlay = () => {
      if (!el || !el.src) return
      if (el.paused) {
        if (el.duration && el.currentTime >= el.duration) el.currentTime = 0
        void el.play()
      } else el.pause()
    }
    const cycleSpeed = () => setRate(SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length])

    const seekAt = (clientX: number) => {
      const t = trackRef.current
      if (!t || !el || !duration) return
      const r = t.getBoundingClientRect()
      const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
      el.currentTime = f * duration
      setCurrentTime(f * duration)
    }
    const onTrackDown = (e: React.MouseEvent) => {
      e.preventDefault()
      seekAt(e.clientX)
      const move = (ev: MouseEvent) => seekAt(ev.clientX)
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    }

    const setVolAt = (clientX: number) => {
      const v = volRef.current
      if (!v) return
      const r = v.getBoundingClientRect()
      const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
      setVolume(f)
      if (f > 0) setMuted(false)
    }
    const onVolDown = (e: React.MouseEvent) => {
      e.preventDefault()
      setVolAt(e.clientX)
      const move = (ev: MouseEvent) => setVolAt(ev.clientX)
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    }

    return (
      <div className="flex flex-shrink-0 items-center gap-5 border-t border-border bg-white px-5 py-2.5">
        {/* audio element stays mounted; hidden — src is toggled by the parent */}
        <audio ref={setRef} preload="auto" className="hidden" />

        {!hasAudio ? (
          <span className="flex items-center gap-2 py-2 font-semibold text-[#b45309]">
            <AlertTriangle className="size-[18px]" /> No audio found for this key
          </span>
        ) : (
          <>
            {/* 1. Track info */}
            <div className="flex w-[230px] flex-shrink-0 items-center gap-2.5">
              <Equalizer playing={playing} />
              <div className="min-w-0">
                <div className="truncate font-mono text-xs text-[#334155]" title={fileName}>
                  {fileName}
                </div>
                {variants.length > 1 ? (
                  <div className="mt-0.5 flex items-center gap-1" title="Alternate takes for this key">
                    {variants.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => onVariant(v)}
                        className={cn(
                          'rounded px-1.5 py-px text-[10px] font-medium transition-colors',
                          v === activeVariant
                            ? 'bg-customBlue-600 text-white'
                            : 'bg-secondary text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {VARIANT_LABEL[v]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-[#94a3b8]">matched clip</div>
                )}
              </div>
            </div>

            {/* 2. Transport + scrubber */}
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  title="Replay from start"
                  onClick={onReplay}
                  className="text-muted-foreground transition-colors hover:text-customBlue-600"
                >
                  <SkipBack className="size-[18px]" />
                </button>
                <button
                  type="button"
                  title={playing ? 'Pause' : 'Play'}
                  onClick={togglePlay}
                  className="flex size-10 items-center justify-center rounded-full bg-customBlue-600 text-white shadow-[0_2px_6px_rgba(8,138,178,0.35)] transition-transform hover:bg-customBlue-700 active:scale-95"
                >
                  {playing ? (
                    <Pause className="size-[18px]" fill="currentColor" />
                  ) : (
                    <Play className="ml-0.5 size-[18px]" fill="currentColor" />
                  )}
                </button>
                <button
                  type="button"
                  title="Playback speed"
                  onClick={cycleSpeed}
                  className="min-w-[44px] rounded bg-secondary px-2.5 py-[5px] text-center font-mono text-xs font-semibold text-secondary-foreground transition-colors hover:bg-[#e2e8f0]"
                >
                  {rate}×
                </button>
              </div>

              <div className="flex w-full max-w-[560px] items-center gap-2.5">
                <span className="w-8 flex-shrink-0 text-right font-mono text-[11px] text-[#94a3b8]">
                  {fmt(currentTime)}
                </span>
                <div
                  ref={trackRef}
                  onMouseDown={onTrackDown}
                  className="relative flex h-3.5 flex-1 cursor-pointer items-center"
                >
                  <div className="h-[5px] w-full rounded-full bg-[#e2e8f0]" />
                  <div
                    className="absolute h-[5px] rounded-full bg-customBlue-600"
                    style={{ width: `${frac * 100}%` }}
                  />
                  <div
                    className="absolute size-[13px] rounded-full border-2 border-white bg-customBlue-600 shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
                    style={{ left: `${frac * 100}%`, transform: 'translateX(-50%)' }}
                  />
                </div>
                <span className="w-8 flex-shrink-0 font-mono text-[11px] text-[#94a3b8]">{fmt(duration)}</span>
              </div>
            </div>

            {/* 3. Volume */}
            <div className="flex w-[150px] flex-shrink-0 items-center gap-2">
              <button
                type="button"
                title={muted || volume === 0 ? 'Unmute' : 'Mute'}
                onClick={() => setMuted((m) => !m)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {muted || volume === 0 ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
              </button>
              <div ref={volRef} onMouseDown={onVolDown} className="relative flex h-3.5 flex-1 cursor-pointer items-center">
                <div className="h-1 w-full rounded-full bg-[#e2e8f0]" />
                <div className="absolute h-1 rounded-full bg-[#94a3b8]" style={{ width: `${effVol * 100}%` }} />
                <div
                  className="absolute size-[11px] rounded-full bg-[#64748b]"
                  style={{ left: `${effVol * 100}%`, transform: 'translateX(-50%)' }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    )
  },
)
AudioBar.displayName = 'AudioBar'

/** 4-bar equalizer thumbnail; bars animate only while playing. */
function Equalizer({ playing }: { playing: boolean }) {
  const bars = [
    { h: 8, d: 0 },
    { h: 15, d: 0.15 },
    { h: 11, d: 0.3 },
    { h: 13, d: 0.45 },
  ]
  return (
    <div className="flex size-[34px] flex-shrink-0 items-end justify-center gap-[3px] rounded-lg bg-customBlue-50 p-[7px]">
      {bars.map((b, i) => (
        <span
          key={i}
          className="w-[3px] rounded-sm bg-customBlue-600"
          style={{
            height: b.h,
            transformOrigin: 'bottom',
            transform: playing ? undefined : 'scaleY(0.45)',
            animation: playing ? `eqbar 0.9s ease-in-out ${b.d}s infinite` : undefined,
          }}
        />
      ))}
    </div>
  )
}

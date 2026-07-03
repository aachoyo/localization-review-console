import { useEffect } from 'react'
import { useReviewStore } from '@/store/useReviewStore'

interface Options {
  /** true while the note editor is open — suppress global shortcuts */
  noteOpen: boolean
  onTogglePlay: () => void
}

/**
 * Global keyboard shortcuts: Space = play/pause, Arrow keys = navigate.
 * Ignored while typing in an input/textarea or while the note editor is open.
 */
export function useKeyboard({ noteOpen, onTogglePlay }: Options) {
  const next = useReviewStore((s) => s.next)
  const prev = useReviewStore((s) => s.prev)
  const count = useReviewStore((s) => s.strings.length)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement
      const typing = el instanceof HTMLElement && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')
      if (noteOpen || typing || count === 0) return

      if (e.code === 'Space') {
        e.preventDefault()
        onTogglePlay()
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [noteOpen, onTogglePlay, next, prev, count])
}

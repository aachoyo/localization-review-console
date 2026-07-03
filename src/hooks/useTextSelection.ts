/**
 * Selection -> character-offset helpers for highlight-to-note.
 *
 * Offsets are computed against the panel's full plain text via a text-node
 * TreeWalker, so they stay correct even when the panel already contains
 * <mark> spans from earlier highlights.
 */

/** Character offset of (node, offset) within `container`'s text content. */
export function getTextOffset(container: Node, node: Node, offset: number): number {
  let total = 0
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
  let n: Node | null
  while ((n = walker.nextNode())) {
    if (n === node) return total + offset
    total += n.textContent?.length ?? 0
  }
  return total
}

export interface SelectionSpan {
  start: number
  end: number
  text: string
  rect: DOMRect
}

/**
 * If there's a non-collapsed selection fully inside `panelEl`, return its
 * character span (relative to `fullText`) plus a bounding rect for anchoring
 * the note editor. Otherwise null.
 */
export function readSelectionSpan(panelEl: HTMLElement, fullText: string): SelectionSpan | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.toString().trim()) return null
  const range = sel.getRangeAt(0)
  if (!panelEl.contains(range.startContainer) || !panelEl.contains(range.endContainer)) return null

  let start = getTextOffset(panelEl, range.startContainer, range.startOffset)
  let end = getTextOffset(panelEl, range.endContainer, range.endOffset)
  if (start > end) [start, end] = [end, start]

  const text = fullText.slice(start, end).trim()
  if (!text) return null

  return { start, end, text, rect: range.getBoundingClientRect() }
}

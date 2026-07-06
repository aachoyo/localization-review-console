import { useEffect, useState } from 'react'

export function Welcome() {
  const [supportsDir, setSupportsDir] = useState(true)
  useEffect(() => {
    setSupportsDir('webkitdirectory' in document.createElement('input'))
  }, [])

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-xl text-center">
        <h2 className="mb-1.5 text-2xl font-semibold">Drag two things in, review, export.</h2>
        <p className="text-muted-foreground">
          Everything runs in your browser. Nothing is uploaded; nothing is written back to your source files.
        </p>
        <ol className="mx-auto my-5 inline-block list-decimal space-y-1.5 text-left text-muted-foreground">
          <li>
            <b className="text-foreground">Pick your language</b>, then <b className="text-foreground">load the
            review sheet</b> — the multi-sheet <code>.xlsx</code>; only Key, English, and your language are read.
          </li>
          <li>
            <b className="text-foreground">Load the audio folder</b> — the parent of the per-language folders
            (<code>NE</code>, <code>BN</code>, …). Every <code>.mp3</code> is indexed by language + key. You can
            also drag a folder onto this window.
          </li>
          <li>
            Read the three panels, hit <b className="text-foreground">Space</b> to hear it, select bad text to
            add a note, <b className="text-foreground">→</b> to move on.
          </li>
          <li>
            Click <b className="text-foreground">Export notes</b> for a fresh <code>.xlsx</code> to hand back.
          </li>
        </ol>
        {!supportsDir && (
          <div className="mt-3.5 text-[13px] text-status-warn">
            ⚠ Your browser may not support folder loading. Use Chrome or Edge for the audio folder step.
          </div>
        )}
      </div>
    </div>
  )
}

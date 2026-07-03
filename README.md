# Localization Review Console

Client-side tool for reviewing Nepali (or other-language) voice-over localizations
against their English source. Loads a review spreadsheet plus a folder of audio
clips and presents each string as English → Nepali → phonetic romanization with a
matched player; reviewers highlight spans, attach notes, and flag rows. Export
produces a new spreadsheet — source files are never mutated.

Fully client-side: no backend, no network calls, no writes to input files.

## Stack

React 18 · Vite · TypeScript · Tailwind + shadcn/ui-style primitives ·
Zustand (state) · SheetJS (`xlsx`) · Vitest.

## Commands

```bash
npm install
npm run dev       # dev server → http://localhost:5177
npm test          # romanizer acceptance suite
npm run build     # tsc --noEmit + production build → dist/
npm run preview   # serve the built dist/
```

## Deploy

`npm run build` emits a static `dist/` — host it anywhere static (S3, GitHub
Pages, internal web server). `vite.config.ts` sets `base: './'` for sub-path
hosting; for a GitHub Pages *project* page, set `base: '/<repo-name>/'`.

## Usage

Input is an `.xlsx` with `Key` / `English` / `Nepali` columns (extra columns
tolerated, headers matched case-insensitively) and a folder of `.mp3`s indexed by
filename stem (`stem == Key`). A folder can be dropped onto the window in
Chromium browsers. Reviewers navigate with ←/→, play with Space, select text in
the Nepali/Romanized panels to attach span notes (orange = phrasing, red =
serious), or flag a whole row. Export writes `review_notes_<sheet>.xlsx`
(Key, English, Nepali, Romanized, Notes). Keys with no matching clip render an
explicit empty state rather than failing silently.

## Dependency & audit posture

The shipped artifact is the static `dist/` build — no dev server, no build
tooling. Given that:

- `xlsx` is pinned to the official SheetJS build (`cdn.sheetjs.com/xlsx-0.20.3`),
  not the npm package. The npm package is stuck at 0.18.5 (`No fix available`)
  with prototype-pollution + ReDoS advisories; 0.20.x patches them. This is
  SheetJS's documented install method.
- `esbuild` is pinned to `^0.25.0` via `overrides`, clearing the dev-server
  advisory without a Vite major bump.
- Remaining `npm audit` warnings are all in the Vite/Vitest dev toolchain and
  apply only to `npm run dev` — none ship in `dist/`. We deliberately avoid
  `npm audit fix --force` (breaking Vite major, no production benefit); revisit
  on the next Vite/Vitest major adoption.

## Layout

```
src/
  lib/          romanizer, spreadsheet parse/export, audio indexing, types
  store/        Zustand review store
  hooks/        keyboard shortcuts, selection→offset logic
  components/   Header, Sidebar, StringView, TextPanel, AudioBar,
                NotePopover, NoteList, Toolbar, Welcome, ui/
```

`src/lib/romanizer.ts` is a pure Devanagari→phonetic engine; its behavior is
pinned by `romanizer.test.ts` (PRD §8 acceptance cases). Keep those green when
changing romanization rules.

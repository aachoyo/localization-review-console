# Technical Implementation Spec — Multi-Language Expansion (v2)

> Audience: an implementing agent (Claude Code) working **in the existing repo**. This is an extension of a working codebase, not a greenfield build. Preserve existing behavior and the read-only invariant. Keep TypeScript strict; `npm run build` (which runs `tsc --noEmit`) and `npm test` must stay green.

## 0. Current architecture (ground truth)

Client-side React 18 + Vite + TypeScript. State in Zustand. Reads XLSX with SheetJS. No backend, no network.

Key files and their current responsibilities:

- `src/lib/types.ts` — domain types. `StringRow` currently has language-specific fields `nepali` and `roman`; `PanelName = 'nepali' | 'roman'`.
- `src/lib/spreadsheet.ts` — `parseWorkbook(ArrayBuffer)` reads **only the first sheet**, matches columns by **display-name substring** (`h.includes('nepali')`), builds `StringRow[]`. `exportNotes(rows, baseName)` writes a new styled `.xlsx` (currently via SheetJS/`xlsx-js-style`). `buildNotesCell(row)` renders the Notes text.
- `src/lib/audio.ts` — `indexAudioFiles(File[])` builds `AudioIndex` keyed by filename **stem only**. `matchAudio(index, key)` looks up by stem. `readDroppedEntries(items)` recursively walks a dropped folder but **discards folder paths**, returning a flat `File[]`.
- `src/lib/romanizer.ts` — pure Devanagari→Latin engine, `romanize(text)`. Covers Nepali + Hindi (same script).
- `src/store/useReviewStore.ts` — `strings`, `cursor`, `audio`, `sheetBaseName`; `loadStrings` (auto-marks row 0 `seen`), `setCursor` (auto-marks navigated row `seen`), `statusOf` (`flagged` > `seen` > `untouched`), highlight/flag mutations.
- `src/App.tsx` — owns the persistent `<audio>` (`audioRef`), `file` = `matchAudio(audio, row.key)`, `togglePlay`/`replay`, note `draft` state, `onDrop`, `useKeyboard`.
- `src/components/` — `Header` (load sheet → `parseWorkbook` → `loadStrings`; load audio → `indexAudioFiles` → `setAudio`; export → `exportNotes`), `StringView` (renders English + `nepali` + `roman` panels), `TextPanel`, `NotePopover`, `NoteList`, `Toolbar`, `AudioBar`, `Sidebar`, `Welcome`.
- `src/hooks/useTextSelection.ts` — `readSelectionSpan` / `getTextOffset` produce exact character offsets for highlights.

### Real data shapes to code against

**Workbook** (`Module NN … VO Strings.xlsx`): multiple sheets. Non-data tabs like `Summary`, `Arabic issues`. Data tabs like `Sub00 - Introduction` … `Sub12 - …`. Header row per data sheet:

```
Key | Arabic(ar) | English(en) | Bangla(bn) | Custom(urvo) | Malayalam(ml) |
Urdu(ur) | Hindi(hi) | Urdu Transliterated | French(fr) | Custom(tag) |
Tamil(ta) | Nepali (ne) | Character | Word Count (EN)
```

Language columns carry an **ISO code in parentheses**. Note `Bangla(bn)` (not "Bengali") and inconsistent spacing (`Nepali (ne)`) — match on the parenthesized code, tolerant of whitespace/case.

**Audio**: `LocalizedAudio/Mod02Sub01_VOAudio/<CODE>/<Key>.mp3`, where `<CODE>` ∈ `AR BN EN HI ML NE TA TAG UR`. Filename stem == string `Key`. Every `.mp3` has a sibling `.mp3.meta` (Unity; ignore — already filtered by the `.mp3` test). **The same stem exists in every language folder**, so audio indexing MUST be language-scoped. Variant clips exist (`…_KSA.mp3`, parallel `…_VO_RetailAudio/` folders).

## 1. Invariants (do not break)

1. **Read-only inputs, notes-only output.** Never open source files for writing. The only artifact written is the notes export. Do not add any network calls.
2. **Backward compatibility.** The existing single-sheet, name-matched Nepali flow should continue to work (treat it as the `ne` profile). Existing tests must pass.
3. **Strict TS + green build/tests** after every work item.

## 2. Work items

Implement in this order; each is independently shippable and testable.

---

### WI-1 — Language profile registry  *(foundational; do first)*

**New file: `src/lib/languages.ts`.**

Define a `LanguageProfile` and a registry keyed by ISO code:

```ts
export type ScriptDirection = 'ltr' | 'rtl'

export interface LanguageProfile {
  code: string          // ISO: 'ne','hi','bn','ta','ml'
  name: string          // display: 'Nepali','Bengali',...
  folderCode: string    // audio subfolder + sheet code, UPPER: 'NE','BN',...
  direction: ScriptDirection
  font: string          // CSS font-family, e.g. 'Noto Sans Bengali'
  romanize?: (text: string) => string   // optional engine; omit if none
}

export const LANGUAGES: Record<string, LanguageProfile> = { /* ne, hi, bn, ta, ml */ }

export function profileByCode(code: string): LanguageProfile | undefined
export function profileByFolder(folderCode: string): LanguageProfile | undefined  // case-insensitive
```

- Wire the existing `romanize` from `romanizer.ts` into the `ne` and `hi` profiles (same Devanagari engine).
- `bn`, `ta`, `ml` ship with **no `romanize`** in this release (F8 makes romanization optional). Leave a clear extension point.
- Fonts: reference Noto families (`Noto Sans Devanagari`, `Noto Sans Bengali`, `Noto Sans Tamil`, `Noto Sans Malayalam`). Add `@fontsource` deps or `<link>` includes; document which.
- All in-scope profiles are `ltr`. Keep `direction` in the type so Phase 3 (RTL) drops in without a schema change.

**Acceptance:** `profileByCode('bn')?.name === 'Bengali'`; `profileByFolder('ne')?.code === 'ne'`.

---

### WI-2 — Generalize the data model

**File: `src/lib/types.ts`.**

- Rename the language-bound field: `nepali: string` → `target: string` (the active language's text). Update `roman: string` to stay (generated/sheet transliteration of `target`).
- `PanelName`: change `'nepali' | 'roman'` → `'target' | 'roman'`.
- Add to `StringRow`: `checked: boolean` (manual completion, WI-6). Keep `seen: boolean` but redefine it as "visited" only.
- Add `langCode: string` to `StringRow` (or hold the active code in the store — see WI-3; prefer store-level to avoid duplicating per row).

Update all references to `.nepali` / `'nepali'` across `store`, `components/StringView.tsx`, `NotePopover.tsx`, `spreadsheet.ts`. This is a mechanical rename plus the semantic split of `seen`/`checked`.

**Acceptance:** compiles; `StringView` renders `row.target` in the target panel with the active profile's font.

---

### WI-3 — Multi-sheet, code-based workbook ingestion

**File: `src/lib/spreadsheet.ts`, function `parseWorkbook`.** Extend (don't discard the current logic — generalize it):

1. Iterate **all** `wb.SheetNames`, not just the first.
2. Classify a sheet as reviewable iff its header row contains both a `Key` column and an English column matched by code `(en)`. Skip others (`Summary`, `Arabic issues`).
3. Column matching: match the target column by **parenthesized ISO code**, tolerant of case and internal spaces — regex like `/\((\s*[a-z]{2,4}\s*)\)/i` on the header, compared to the active `folderCode`/`code`. Keep a name-substring fallback for the legacy single-language sheet.
4. Accept an **active language code** parameter: `parseWorkbook(data, activeCode)`. Extract only `Key`, English `(en)`, and the `(activeCode)` column into `StringRow.target`. Do **not** carry other language columns into memory (confidentiality, F3/§6).
5. Populate `transFromSheet` from a sheet-provided transliteration column when one exists for the active language (e.g. `Urdu Transliterated`); else `''`.
6. Preserve submodule provenance: tag each `StringRow` with its source sheet name (add `submodule: string` to `StringRow`) so the export can group by submodule (Open Decision #1).

Set `roman`: if the profile has `romanize`, generate from `target`; else `transFromSheet || ''`.

**Acceptance:** loading the sample `Module 02 …xlsx` with `activeCode='ne'` yields rows from every `Sub*` sheet, `target` populated from `Nepali (ne)`, no other language text present in memory; `Summary`/`Arabic issues` skipped.

---

### WI-4 — Language-scoped audio indexing  *(correctness-critical)*

**File: `src/lib/audio.ts`.**

- `readDroppedEntries` / `readEntry`: **capture the top-level language subfolder** for each file. Track the path during recursion (the entry exposes `fullPath`); return `Array<{ file: File; langFolder: string }>` (the immediate child-of-root directory name), or thread a `relativePath`. Do not keep a flat, path-less list.
- `indexAudioFiles`: build a **nested index** `Map<folderCodeUpper, Map<stem, File>>` (keep a lowercase-stem fallback map per language). Rationale: identical stems across language folders — a flat index silently returns the wrong language.
- `matchAudio(index, langFolderCode, key)`: look up within the active language's map only.
- Ignore non-`.mp3` (existing filter handles `.mp3.meta`).
- **Variants:** in this release, treat a clip whose stem exactly equals the Key as canonical; do not let `…_KSA` / `_Retail` variants overwrite the canonical entry. Optionally collect variant stems per key into a side list for a future UI (do not surface yet).

**Update callers:** `App.tsx` `file = matchAudio(audio, activeProfile.folderCode, row.key)`; `Header.tsx` `onAudio` and `App.tsx` `onDrop` build the nested index.

**Acceptance:** dropping `Mod02Sub01_VOAudio/` and selecting `ne` plays the NE clip for a key; switching to `bn` plays the BN clip for the same key (no collision).

---

### WI-5 — Language selector (store + UI)

**Store (`useReviewStore.ts`):** add `activeLang: string` (ISO code) and `setActiveLang(code)`. Add `availableLangs: string[]` derived from the loaded audio index (folder codes present) ∩ registry. Changing language should re-derive `target`/`roman` for the loaded rows — simplest correct approach: re-run extraction from the retained parsed workbook for the new code (keep the parsed workbook `ArrayBuffer`/rows-by-lang in memory, or re-`parseWorkbook` with the new code). Do not leak other languages into state when switching.

**UI:** a dropdown in `Header.tsx` bound to `activeLang`, options = `availableLangs` mapped through `profileByCode` for display names. On change, call `setActiveLang`.

**Acceptance:** selecting a language updates the target panel text, its font, and the audio played, consistently.

---

### WI-6 — Manual completion checks

**Store (`useReviewStore.ts`):**

- Stop auto-marking completion. `loadStrings` must **not** set `seen`/`checked` on row 0. `setCursor` may set `seen: true` (visited) but must **never** set `checked`.
- Add `toggleChecked(index?)` mutating `checked` for the current (or given) row.
- `statusOf`: return `flagged` if highlights/flags exist; else `checked` → a new `'checked'` status; else `'visited'` if `seen`; else `'untouched'`. Update `StringStatus` in `types.ts` accordingly (`'untouched' | 'visited' | 'checked' | 'flagged'`).

**UI:** a checkbox in `StringView`/`Toolbar` bound to the current row's `checked`. `Sidebar` progress counts **checked** rows only.

**Acceptance:** navigating through strings does not increase the completion count; only ticking the box does.

---

### WI-7 — Audio continuity during note-taking

**File: `src/App.tsx`.** Today opening a note (`draft`) coincides with audio restarting. Fix + add a setting.

- Add a setting `noteAudioMode: 'keep-playing' | 'pause-resume'` (store it; expose a small toggle in `Header`/`Toolbar`; default `'pause-resume'`).
- When a note opens (`draft` transitions null→set): capture `wasPlaying = !audioRef.current.paused` and `currentTime`. If mode is `pause-resume`, `pause()` (do **not** reset `currentTime`). If `keep-playing`, do nothing.
- When the note closes (save or cancel): if mode is `pause-resume` and `wasPlaying`, resume with `play()` from the retained position. Never set `currentTime = 0` on note transitions (that reset is `replay`'s job only).
- Verify the `useEffect([file])` that sets `el.src` is not re-firing on note open: adding a highlight creates a new `row` object, so `file` is re-evaluated — ensure `matchAudio` returns the **same `File` reference** (it does, from the map) so the effect's `[file]` dep doesn't change and reload/reset the element. If needed, memoize on `row.key` instead of `row`.

**Acceptance:** with audio playing, selecting text and writing a note does not restart playback; behavior matches the chosen mode.

---

### WI-8 — Highlights preserved in export (switch writer to ExcelJS)

**File: `src/lib/spreadsheet.ts`, `exportNotes`.** Replace the SheetJS/`xlsx-js-style` **write** path with **ExcelJS** (keep SheetJS for reading in `parseWorkbook`). Add `exceljs` dependency; remove `xlsx-js-style` if unused elsewhere.

Requirements the writer must satisfy (this also subsumes the earlier styling asks — column width, wrap, header fill, per-column fonts):

- Columns: `Key, English, <LanguageName>, Romanized, Notes`; group by submodule if Open Decision #1 = grouped (one worksheet per submodule) — otherwise one sheet.
- Column width ~250px, `wrapText` on all cells, header row **black fill + white bold text**.
- Target-language column font = active profile font (e.g. Noto Sans Bengali); other columns Roboto Condensed.
- **Exact-span highlights:** for the target cell, build ExcelJS **rich text** runs from `row.highlights` (which are `{panel:'target', start, end, color}` offsets into `row.target`): split the string at highlight boundaries and emit runs; highlighted runs get font color orange (`FFF39C12` or chosen) or red (`FFE74C3C`) per `color`; plain runs default. Non-overlapping assumption: sort by `start`, clamp/merge overlaps defensively.
- Notes cell: keep `buildNotesCell` output; wrap; top-aligned.

**Acceptance:** exporting a row with a highlighted phrase produces a target cell whose flagged words render in the severity color, rest default; widths/wrap/header/fonts applied.

---

### WI-9 — Romanization as optional toggle

**Files: `StringView.tsx` (+ store).**

- Add `showRomanization: boolean` (store, default per Open Decision #3). A toggle in `Header`/`Toolbar` shows/hides the Romanized panel.
- Source of romanization per row: `row.roman` = `profile.romanize?.(target)` if the profile has an engine, else `transFromSheet`. If neither exists, hide the panel automatically for that language and disable the toggle.
- The `roman` panel must remain highlightable exactly as today (its offsets are independent of the target panel).

**Acceptance:** for `bn`/`ta`/`ml` (no engine, no sheet translit) the panel is absent/disabled; for `ne`/`hi` it toggles generated romanization; for a language with a sheet translit column, that text shows.

## 3. Testing

- Extend `src/lib/romanizer.test.ts` patterns with new suites:
  - `spreadsheet.test.ts`: multi-sheet classification (data vs Summary/issues), code-based column match incl. `Bangla(bn)` and `Nepali (ne)` spacing, per-language extraction excludes other languages, submodule tagging.
  - `audio.test.ts`: nested index does not collide identical stems across `NE`/`BN`; `matchAudio` returns language-correct clip; `.mp3.meta` ignored; `_KSA` variant does not overwrite canonical.
  - `languages.test.ts`: `profileByCode`/`profileByFolder` round-trips.
- Keep `npm run build` (`tsc --noEmit`) and `npm test` green after each WI.

## 4. Out of scope (do not implement)

- Backend, DB, accounts, saved progress (Phase 2). In-memory only.
- RTL (`ar`/`ur`) rendering and bidi selection (Phase 3).
- Editing / change-request / audio regeneration (separate team tool).
- Surfacing audio variants in the UI (collect only; no UI this release).

## 5. Suggested file-change summary

| File | Change |
|---|---|
| `src/lib/languages.ts` | **new** — profile type + registry + lookups (WI-1) |
| `src/lib/types.ts` | `nepali`→`target`; `PanelName` `'target'`; add `checked`, `submodule`; `StringStatus` values (WI-2, WI-6) |
| `src/lib/spreadsheet.ts` | multi-sheet + code-based parse + per-lang extraction (WI-3); ExcelJS writer w/ rich-text highlights (WI-8) |
| `src/lib/audio.ts` | path capture + nested language-scoped index + `matchAudio(code,key)` (WI-4) |
| `src/store/useReviewStore.ts` | `activeLang`/`availableLangs`/`setActiveLang`; `toggleChecked`; stop auto-complete; `showRomanization`; `noteAudioMode` (WI-5,6,7,9) |
| `src/App.tsx` | audio continuity on note open/close; `matchAudio` new signature (WI-7,4) |
| `src/components/Header.tsx` | language dropdown; audio/romanization/note-mode toggles; new `parseWorkbook` signature (WI-5,7,9) |
| `src/components/StringView.tsx` | `row.target` + profile font; checkbox; optional roman panel (WI-2,6,9) |
| `src/components/Sidebar.tsx` | progress counts `checked` only (WI-6) |
| tests | `spreadsheet`, `audio`, `languages` suites (WI-3,4,1) |
| deps | add `exceljs` (+ Noto fonts); drop `xlsx-js-style` if unused |

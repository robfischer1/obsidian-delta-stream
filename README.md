# obsidian-delta-stream

Personal Obsidian plugin that captures CodeMirror 6 editing deltas — insertions, deletions, pauses, selections — as an append-only event log. The `.md` file stays canonical; the delta stream is the substrate underneath it.

**Status:** Phase 4 settings + privacy controls complete (2026-05-19). Full settings tab live, capture is off by default per vault, exclusions take effect at the capture layer (zero events emitted for excluded notes), and a one-click "Add never-draft folders" shortcut is offered. Phase 5 (phdb ingest), Phase 6 (MCP), and Phase 7 (writing-arc panel) follow.

**Privacy:** Local-only. No cloud sync. Off by default per vault. Personal infrastructure — not for distribution.

## Layout

| Path | Purpose |
| :--- | :--- |
| `src/main.ts` | Plugin lifecycle (`onload` / `onunload`, command, status bar, active-leaf + blur wiring) |
| `src/settings.ts` | Settings tab (re-exports `DeltaStreamSettings` + `DEFAULT_SETTINGS` from `settings-types.ts`) |
| `src/settings-types.ts` | Settings interface + defaults — no `obsidian` runtime imports, safe to depend on from tests |
| `src/capture/events.ts` | `DeltaEvent` union type — doc / selection / session-start / session-end / note-switch |
| `src/capture/exclusion.ts` | Folder-path exclusion predicate (Phase 4 enforces here, per the capture-layer rule) |
| `src/capture/buffer.ts` | Fixed-capacity ring buffer with subscriber callbacks |
| `src/capture/session.ts` | Idle-timer session-boundary tracker |
| `src/capture/changes.ts` | Pure `ChangeSet → DocChangeEvent[]` extraction (testable without an EditorView) |
| `src/capture/view-plugin.ts` | CodeMirror 6 ViewPlugin adapter |
| `src/capture/dispatcher.ts` | Obsidian-facing wiring — active file, sessions, ring buffer, frontmatter type lookup |
| `src/capture/__tests__/` | vitest suite for capture — 34 tests across 5 files |
| `src/persistence/paths.ts` | Day-partitioned NDJSON filename + storage-dir defaulting |
| `src/persistence/writer.ts` | Append-only NDJSON writer; concurrent calls serialise through a promise queue |
| `src/persistence/persister.ts` | Ring-buffer subscriber that buckets by day, flushes on interval + session-end |
| `src/persistence/__tests__/` | vitest suite for persistence — 19 tests across 3 files |
| `manifest.json` | Obsidian plugin manifest (id `obsidian-delta-stream`, desktop-only) |
| `esbuild.config.mjs` | Bundles `src/main.ts` → `main.js` |
| `eslint.config.mts` | `eslint-plugin-obsidianmd` flat config |
| `.github/workflows/lint.yml` | CI: build + lint on every push |
| `AGENTS.md` | Obsidian community-plugin conventions (carried over from the sample plugin) |
| `CLAUDE.md` | Claude Code session entry — imports AGENTS.md, links to the parent plan |

## Build

```bash
npm install
npm run dev       # watch mode → main.js
npm run build     # production bundle
npm run lint
npm test          # vitest run
```

## Install in a test vault

Copy `main.js`, `manifest.json` (and `styles.css` if any) to:

```
<TestVault>/.obsidian/plugins/obsidian-delta-stream/
```

Reload Obsidian → **Settings → Community plugins** → enable.

## Plan

The implementation plan lives in the vault at `Outputs/Plans/Writing Delta Stream Capture.md` with Phase 0 resolutions in `Writing Delta Stream Capture DECISIONS.md`. Phases:

1. **Scaffold** *(complete)* — TypeScript + esbuild, eslint-plugin-obsidianmd, minimal plugin shell.
2. **CM6 capture extension** *(complete)* — `ViewPlugin` reading `ViewUpdate` transactions; events land in an in-memory ring buffer.
3. **NDJSON persistence** *(complete)* — append-only day-partitioned files at `~/Obsidian/delta-stream-data/`; flushes on interval + every `session-end`.
4. **Settings + privacy controls** *(complete)* — full settings tab with capture/storage/privacy sections, exclusion list with "Add never-draft folders" shortcut, and live status-bar indicator visibility.
5. **personal-history-db ingest adapter** — migration `0013_writing_deltas`, typed columns.
6. **MCP query surface** — `writing_arc`, `writing_session_for_note`.
7. **Writing-arc panel** — Obsidian sidebar `ItemView` reading the MCP surface.

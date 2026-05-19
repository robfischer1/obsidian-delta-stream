# obsidian-delta-stream

Personal Obsidian plugin that captures CodeMirror 6 editing deltas — insertions, deletions, pauses, selections — as an append-only event log. The `.md` file stays canonical; the delta stream is the substrate underneath it.

**Status:** Phase 1 scaffold (2026-05-19). Capture, persistence, ingest, and consumer phases follow.

**Privacy:** Local-only. No cloud sync. Off by default per vault. Personal infrastructure — not for distribution.

## Layout

| Path | Purpose |
| :--- | :--- |
| `src/main.ts` | Plugin lifecycle (`onload` / `onunload`, command, status bar) |
| `src/settings.ts` | `DeltaStreamSettings` interface + defaults + settings tab |
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
```

## Install in a test vault

Copy `main.js`, `manifest.json` (and `styles.css` if any) to:

```
<TestVault>/.obsidian/plugins/obsidian-delta-stream/
```

Reload Obsidian → **Settings → Community plugins** → enable.

## Plan

The implementation plan lives in the vault at `Outputs/Plans/Writing Delta Stream Capture.md` with Phase 0 resolutions in `Writing Delta Stream Capture DECISIONS.md`. Phases:

1. **Scaffold** *(this commit)* — TypeScript + esbuild, eslint-plugin-obsidianmd, minimal plugin shell.
2. **CM6 capture extension** — `ViewPlugin` reading `ViewUpdate` transactions.
3. **NDJSON persistence** — append-only day-partitioned files at `~/Obsidian/delta-stream-data/`.
4. **Settings + privacy controls** — folder exclusions, never-draft shortcut, status indicator.
5. **personal-history-db ingest adapter** — migration `0013_writing_deltas`, typed columns.
6. **MCP query surface** — `writing_arc`, `writing_session_for_note`.
7. **Writing-arc panel** — Obsidian sidebar `ItemView` reading the MCP surface.

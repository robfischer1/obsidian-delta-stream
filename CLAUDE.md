# CLAUDE.md — obsidian-delta-stream

Sibling repo of the vault at `C:\Users\robfi\Obsidian\Obsidian\`. Plugin scaffold from `obsidianmd/obsidian-sample-plugin`; the sample's `AGENTS.md` is preserved as Obsidian-plugin-dev reference and imported below.

@AGENTS.md

## Project context

- **Parent plan:** `Outputs/Plans/Writing Delta Stream Capture.md` in the vault.
- **Phase 0 decisions:** `Outputs/Plans/Writing Delta Stream Capture DECISIONS.md` in the vault — locked 2026-05-19.
- **Current phase:** Phase 1 scaffold complete; Phase 2 (CM6 capture extension) next.
- **Plugin id:** `obsidian-delta-stream` (matches folder name per Obsidian's local-dev convention).
- **Desktop-only:** true. Phase 3 uses Node `fs` to write outside the vault.

## Sibling repos in `~/Obsidian/`

| Repo | Role here |
| :--- | :--- |
| `Obsidian/` (the vault) | Source of truth for the plan, DECISIONS, governance |
| `personal-history-db/` | Phase 5 ingest adapter target (`src/phdb/adapters/writing_deltas.py`, migration `0013_writing_deltas.sql`) |
| `vault-mcp/` / `personal-history-db-mcp/` | Phase 6 MCP query tools (`writing_arc`, `writing_session_for_note`) |

## Non-negotiables

1. **Local-only.** No network calls, no telemetry, no cloud sync. Phase 3 storage path defaults outside the vault (`~/Obsidian/delta-stream-data/`) and the project is never submitted to the community plugin registry (Phase 0 Q15).
2. **Off by default per vault.** `settings.enabled` defaults to `false`; nothing is captured until Rob explicitly toggles it on.
3. **Excluded notes emit zero events.** Folder exclusion is enforced at the capture layer (Phase 2), not filtered on read.
4. **Lint gate is binding.** `eslint-plugin-obsidianmd` runs in CI and pre-commit; do not bypass.

## Workflow

- **PowerShell, not Bash** (Hephaestus convention; see vault `feedback_powershell_not_bash`).
- `npm install` → `npm run dev` (watch) for active development.
- `npm run build && npm run lint` before any commit.
- Commits use the vault's `changelog` skill convention; this repo's commits do not require a `Vault-History:` trailer but should include `Source: Code` per the protocol.

## Where things live

| Path | Owner |
| :--- | :--- |
| `src/main.ts` | Lifecycle. Keep minimal — push feature work into modules. |
| `src/settings.ts` | `DeltaStreamSettings` interface + defaults + tab. |
| `src/capture/` *(Phase 2)* | CM6 `ViewPlugin`, ring buffer, session bounds. |
| `src/persistence/` *(Phase 3)* | NDJSON writer, flush orchestration. |
| `src/ui/` *(Phase 7)* | Writing-arc side panel `ItemView`. |

/**
 * Settings interface + defaults, with no `obsidian` imports.
 *
 * Split out from `settings.ts` so the dispatcher (and its tests) can depend
 * on the type and defaults without pulling in the settings-tab UI class,
 * which imports the `obsidian` runtime — that runtime only exists inside
 * Obsidian itself, not under Node/vitest.
 */

export interface DeltaStreamSettings {
	/** Master enable/disable per vault. Off by default (Phase 0 Q1 + Q11). */
	enabled: boolean;
	/** Absolute path where per-day NDJSON files are written. Outside the vault by default (Phase 0 Q10). */
	storageDirectory: string;
	/** How often the in-memory ring buffer flushes to disk, in milliseconds. */
	flushIntervalMs: number;
	/** Inter-event idle gap that closes a writing session, in milliseconds (Phase 0 Q12). */
	idleSessionGapMs: number;
	/** Whether to record the actual deleted text in delta events (Phase 0 Q8). */
	captureDeletedText: boolean;
	/** Vault-relative folder paths that are never captured. Ships empty (Phase 0 Q11). */
	excludedFolders: string[];
	/** Show a capture-state indicator in the status bar. */
	showStatusBarIndicator: boolean;
}

export const DEFAULT_SETTINGS: DeltaStreamSettings = {
	enabled: false,
	storageDirectory: '',
	flushIntervalMs: 2_000,
	idleSessionGapMs: 5 * 60 * 1_000,
	captureDeletedText: true,
	excludedFolders: [],
	showStatusBarIndicator: true,
};

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

/**
 * The three vault folders subject to `COWORK.md §3.6`'s never-draft rule.
 * Not seeded into the default exclusion list (Phase 0 Q11 — Rob declined
 * default exclusion since the rule restricts AI authoring, not capture of
 * Rob's own writing). Offered as a one-click shortcut in the settings tab.
 */
export const NEVER_DRAFT_FOLDERS: readonly string[] = [
	'Outputs/The Tao of Rob',
	"Outputs/Rob's Hammer",
	'Outputs/The Diuniverse',
];

/** Parse a multi-line textarea into the exclusion-list shape (trimmed, no empties). */
export function parseExcludedFolders(text: string): string[] {
	return text
		.split('\n')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/** Merge the never-draft folders into the current list, deduped, preserving prior order. */
export function withNeverDraftFolders(current: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const f of current) {
		if (!seen.has(f)) {
			seen.add(f);
			out.push(f);
		}
	}
	for (const f of NEVER_DRAFT_FOLDERS) {
		if (!seen.has(f)) {
			seen.add(f);
			out.push(f);
		}
	}
	return out;
}

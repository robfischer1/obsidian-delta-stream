import path from 'node:path';
import os from 'node:os';

/**
 * Default storage directory when `settings.storageDirectory` is empty —
 * matches Phase 0 Q10's locked default: `~/Obsidian/delta-stream-data/`.
 * Sibling of the vault, outside Obsidian sync and outside any git index.
 */
export function defaultStorageDirectory(): string {
	return path.join(os.homedir(), 'Obsidian', 'delta-stream-data');
}

/** Returns the configured directory if non-empty, else the default. */
export function resolveStorageDirectory(configured: string): string {
	return configured.trim().length > 0 ? configured : defaultStorageDirectory();
}

/** Local-time YYYY-MM-DD filename for a given Date instance. */
export function ndjsonFilenameForDate(d: Date): string {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}.ndjson`;
}

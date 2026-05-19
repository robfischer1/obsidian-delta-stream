/**
 * Read writing-delta NDJSON files from disk and parse them back into events.
 *
 * Mirrors the writer in `src/persistence/writer.ts` — the format is
 * append-only NDJSON, one JSON object per line, day-partitioned at
 * `YYYY-MM-DD.ndjson` in the configured storage directory.
 *
 * Tolerant of trailing partial lines (the Phase 3 crash-safety property).
 * Tolerant of missing day files (just returns the events from days that exist).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { DeltaEvent } from '../capture/events';
import {
	ndjsonFilenameForDate,
	resolveStorageDirectory,
} from '../persistence/paths';

export interface ReadResult {
	events: DeltaEvent[];
	dayFilesRead: number;
	parseErrors: number;
}

/** Read one day file. Returns empty if the file is missing. */
export async function readDayFile(
	storageDirectory: string,
	date: Date,
): Promise<ReadResult> {
	const dir = resolveStorageDirectory(storageDirectory);
	const filename = ndjsonFilenameForDate(date);
	const filepath = path.join(dir, filename);

	let raw: string;
	try {
		raw = await fs.readFile(filepath, 'utf8');
	} catch (err) {
		// ENOENT or directory-missing — return empty cleanly.
		if (isFileNotFoundError(err)) {
			return { events: [], dayFilesRead: 0, parseErrors: 0 };
		}
		throw err;
	}

	const { events, parseErrors } = parseNdjson(raw);
	return { events, dayFilesRead: 1, parseErrors };
}

/**
 * Read the most-recent `days` day files (today + the previous days - 1).
 * Missing day files are skipped without error.
 */
export async function readRecentDays(
	storageDirectory: string,
	days: number,
	now: Date = new Date(),
): Promise<ReadResult> {
	if (days <= 0) return { events: [], dayFilesRead: 0, parseErrors: 0 };

	const all: DeltaEvent[] = [];
	let dayFilesRead = 0;
	let parseErrors = 0;

	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		const result = await readDayFile(storageDirectory, d);
		all.push(...result.events);
		dayFilesRead += result.dayFilesRead;
		parseErrors += result.parseErrors;
	}

	return { events: all, dayFilesRead, parseErrors };
}

/** Parse NDJSON text. Skips blank lines and unparseable trailing partials. */
export function parseNdjson(raw: string): {
	events: DeltaEvent[];
	parseErrors: number;
} {
	const events: DeltaEvent[] = [];
	let parseErrors = 0;
	for (const line of raw.split('\n')) {
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		try {
			const obj = JSON.parse(trimmed) as DeltaEvent;
			events.push(obj);
		} catch {
			parseErrors++;
		}
	}
	return { events, parseErrors };
}

function isFileNotFoundError(err: unknown): boolean {
	if (err === null || typeof err !== 'object') return false;
	const code = (err as { code?: string }).code;
	return code === 'ENOENT' || code === 'ENOTDIR';
}

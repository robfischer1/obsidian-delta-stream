import { describe, expect, it } from 'vitest';

import {
	defaultStorageDirectory,
	ndjsonFilenameForDate,
	resolveStorageDirectory,
} from '../paths';

describe('defaultStorageDirectory', () => {
	it('lives under the user home directory and ends with delta-stream-data', () => {
		const d = defaultStorageDirectory();
		expect(d.endsWith('delta-stream-data')).toBe(true);
		expect(d.includes('Obsidian')).toBe(true);
	});
});

describe('resolveStorageDirectory', () => {
	it('falls back to the default when configured is empty', () => {
		expect(resolveStorageDirectory('')).toBe(defaultStorageDirectory());
	});

	it('falls back to the default when configured is whitespace', () => {
		expect(resolveStorageDirectory('   \t\n')).toBe(defaultStorageDirectory());
	});

	it('returns the configured path verbatim when non-empty', () => {
		expect(resolveStorageDirectory('D:/delta')).toBe('D:/delta');
	});
});

describe('ndjsonFilenameForDate', () => {
	it('formats as zero-padded local-time YYYY-MM-DD.ndjson', () => {
		// Local-time April 7th, 2026 at 09:05:00.
		const d = new Date(2026, 3, 7, 9, 5, 0);
		expect(ndjsonFilenameForDate(d)).toBe('2026-04-07.ndjson');
	});

	it('zero-pads December', () => {
		const d = new Date(2026, 11, 31, 23, 59, 59);
		expect(ndjsonFilenameForDate(d)).toBe('2026-12-31.ndjson');
	});

	it('handles single-digit months and days', () => {
		const d = new Date(2026, 0, 1, 0, 0, 0);
		expect(ndjsonFilenameForDate(d)).toBe('2026-01-01.ndjson');
	});
});

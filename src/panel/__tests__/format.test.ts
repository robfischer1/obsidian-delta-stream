import { describe, expect, it } from 'vitest';

import {
	ellipsize,
	formatDuration,
	formatRelativeTime,
	formatRewriteRatio,
} from '../format';

describe('formatRelativeTime', () => {
	const now = 1_000_000_000_000;

	it('returns "just now" for events under a minute', () => {
		expect(formatRelativeTime(now - 30_000, now)).toBe('just now');
	});

	it('formats minutes', () => {
		expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5m ago');
	});

	it('formats hours', () => {
		expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toBe('3h ago');
	});

	it('formats days', () => {
		expect(formatRelativeTime(now - 2 * 24 * 60 * 60_000, now)).toBe('2d ago');
	});

	it('formats weeks', () => {
		expect(formatRelativeTime(now - 14 * 24 * 60 * 60_000, now)).toBe('2w ago');
	});

	it('falls back to date for old events', () => {
		const tenWeeksAgo = now - 70 * 24 * 60 * 60_000;
		expect(formatRelativeTime(tenWeeksAgo, now)).toMatch(/\d/);
	});
});

describe('formatDuration', () => {
	it('returns "ongoing" for null', () => {
		expect(formatDuration(null)).toBe('ongoing');
	});

	it('formats sub-second', () => {
		expect(formatDuration(500)).toBe('500ms');
	});

	it('formats seconds', () => {
		expect(formatDuration(30_000)).toBe('30s');
	});

	it('formats minutes + seconds', () => {
		expect(formatDuration(90_000)).toBe('1m 30s');
	});

	it('formats hours + minutes', () => {
		expect(formatDuration(3 * 60 * 60_000 + 15 * 60_000)).toBe('3h 15m');
	});
});

describe('formatRewriteRatio', () => {
	it('zero is bare', () => {
		expect(formatRewriteRatio(0)).toBe('0');
	});

	it('< 1 uses two decimals', () => {
		expect(formatRewriteRatio(0.1666)).toBe('0.17');
	});

	it('>= 1 uses two decimals', () => {
		expect(formatRewriteRatio(1.5)).toBe('1.50');
	});
});

describe('ellipsize', () => {
	it('returns short strings unchanged', () => {
		expect(ellipsize('hello', 10)).toBe('hello');
	});

	it('adds ellipsis when over max', () => {
		expect(ellipsize('hello world', 8)).toBe('hello w…');
	});
});

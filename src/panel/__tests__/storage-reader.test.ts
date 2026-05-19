import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
	parseNdjson,
	readDayFile,
	readRecentDays,
} from '../storage-reader';

let tmp: string;

beforeEach(async () => {
	tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'delta-reader-'));
});

afterEach(async () => {
	await fs.rm(tmp, { recursive: true, force: true });
});

function todayFilename(d: Date): string {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}.ndjson`;
}

describe('parseNdjson', () => {
	it('parses one JSON object per non-empty line', () => {
		const raw = '{"type":"session-start","ts":1,"sessionId":"s","notePath":"a.md"}\n' +
			'{"type":"session-end","ts":2,"sessionId":"s","notePath":"a.md","reason":"blur"}\n';
		const result = parseNdjson(raw);
		expect(result.events).toHaveLength(2);
		expect(result.parseErrors).toBe(0);
	});

	it('skips blank lines', () => {
		const raw = '\n\n{"type":"session-start","ts":1,"sessionId":"s","notePath":"a.md"}\n\n';
		const result = parseNdjson(raw);
		expect(result.events).toHaveLength(1);
		expect(result.parseErrors).toBe(0);
	});

	it('counts unparseable trailing partial as parse error, does not throw', () => {
		const raw = '{"type":"session-start","ts":1,"sessionId":"s","notePath":"a.md"}\n' +
			'{"type":"session-end","ts":2,"sessio'; // truncated
		const result = parseNdjson(raw);
		expect(result.events).toHaveLength(1);
		expect(result.parseErrors).toBe(1);
	});
});

describe('readDayFile', () => {
	it('returns empty when the file does not exist', async () => {
		const r = await readDayFile(tmp, new Date(2026, 4, 19));
		expect(r.events).toEqual([]);
		expect(r.dayFilesRead).toBe(0);
		expect(r.parseErrors).toBe(0);
	});

	it('reads back what was written', async () => {
		const d = new Date(2026, 4, 19);
		const filepath = path.join(tmp, todayFilename(d));
		await fs.writeFile(
			filepath,
			'{"type":"session-start","ts":100,"sessionId":"s1","notePath":"A.md"}\n',
			'utf8',
		);
		const r = await readDayFile(tmp, d);
		expect(r.events).toHaveLength(1);
		expect(r.dayFilesRead).toBe(1);
		expect(r.events[0]?.type).toBe('session-start');
	});
});

describe('readRecentDays', () => {
	it('reads multiple day files in chronological order', async () => {
		const now = new Date(2026, 4, 19, 12, 0, 0);
		const day1 = new Date(now);
		day1.setDate(day1.getDate() - 1);
		await fs.writeFile(
			path.join(tmp, todayFilename(day1)),
			'{"type":"session-start","ts":100,"sessionId":"s_yesterday","notePath":"A.md"}\n',
			'utf8',
		);
		await fs.writeFile(
			path.join(tmp, todayFilename(now)),
			'{"type":"session-start","ts":200,"sessionId":"s_today","notePath":"A.md"}\n',
			'utf8',
		);
		const r = await readRecentDays(tmp, 2, now);
		expect(r.dayFilesRead).toBe(2);
		expect(r.events.map((e) => e.sessionId)).toEqual(['s_yesterday', 's_today']);
	});

	it('skips missing day files cleanly', async () => {
		const now = new Date(2026, 4, 19, 12, 0, 0);
		await fs.writeFile(
			path.join(tmp, todayFilename(now)),
			'{"type":"session-start","ts":200,"sessionId":"s_today","notePath":"A.md"}\n',
			'utf8',
		);
		const r = await readRecentDays(tmp, 7, now);
		expect(r.dayFilesRead).toBe(1);
		expect(r.events).toHaveLength(1);
	});

	it('returns empty when days <= 0', async () => {
		const r = await readRecentDays(tmp, 0);
		expect(r.events).toEqual([]);
		expect(r.dayFilesRead).toBe(0);
	});
});

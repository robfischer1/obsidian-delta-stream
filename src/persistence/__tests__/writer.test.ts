import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { NdjsonWriter } from '../writer';

let tmp: string;

beforeEach(async () => {
	tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'delta-writer-'));
});

afterEach(async () => {
	await fs.rm(tmp, { recursive: true, force: true });
});

describe('NdjsonWriter', () => {
	it('ensureDir creates the directory recursively', async () => {
		const target = path.join(tmp, 'a', 'b', 'c');
		const writer = new NdjsonWriter();
		await writer.ensureDir(target);
		const stat = await fs.stat(target);
		expect(stat.isDirectory()).toBe(true);
	});

	it('append writes one line per entry with trailing newline', async () => {
		const filepath = path.join(tmp, 'log.ndjson');
		const writer = new NdjsonWriter();
		await writer.append(filepath, ['{"a":1}', '{"a":2}']);
		await writer.drain();
		const content = await fs.readFile(filepath, 'utf8');
		expect(content).toBe('{"a":1}\n{"a":2}\n');
	});

	it('append is a no-op for an empty batch', async () => {
		const filepath = path.join(tmp, 'log.ndjson');
		const writer = new NdjsonWriter();
		await writer.append(filepath, []);
		await writer.drain();
		await expect(fs.access(filepath)).rejects.toThrow();
	});

	it('serialises concurrent append calls so bytes never interleave', async () => {
		const filepath = path.join(tmp, 'log.ndjson');
		const writer = new NdjsonWriter();
		await Promise.all([
			writer.append(filepath, ['{"i":1}']),
			writer.append(filepath, ['{"i":2}']),
			writer.append(filepath, ['{"i":3}']),
		]);
		await writer.drain();
		const content = await fs.readFile(filepath, 'utf8');
		const lines = content.split('\n').filter((l) => l.length > 0);
		expect(lines).toEqual(['{"i":1}', '{"i":2}', '{"i":3}']);
	});

	it('appends across separate calls preserve prior content', async () => {
		const filepath = path.join(tmp, 'log.ndjson');
		const writer = new NdjsonWriter();
		await writer.append(filepath, ['first']);
		await writer.drain();
		await writer.append(filepath, ['second', 'third']);
		await writer.drain();
		const content = await fs.readFile(filepath, 'utf8');
		expect(content).toBe('first\nsecond\nthird\n');
	});

	it('surfaces write failures via onError instead of throwing', async () => {
		const errors: Error[] = [];
		const writer = new NdjsonWriter({ onError: (e) => errors.push(e) });
		// Path traverses through a real file as if it were a directory — guaranteed EEXIST/ENOTDIR.
		const filepath = path.join(tmp, 'log.ndjson');
		await fs.writeFile(filepath, '');
		const badPath = path.join(filepath, 'nested.ndjson');
		await writer.append(badPath, ['{"a":1}']);
		await writer.drain();
		expect(errors.length).toBe(1);
	});
});

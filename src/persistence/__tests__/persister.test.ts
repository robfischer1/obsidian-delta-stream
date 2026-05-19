import { describe, expect, it } from 'vitest';

import { RingBuffer } from '../../capture/buffer';
import type { DeltaEvent } from '../../capture/events';
import { Persister } from '../persister';
import { NdjsonWriter } from '../writer';

/** Captures every writer call without touching the filesystem. */
class CapturingWriter extends NdjsonWriter {
	readonly dirs: string[] = [];
	readonly appends: Array<{ filepath: string; lines: readonly string[] }> = [];

	constructor() {
		super({});
	}

	async ensureDir(dir: string): Promise<void> {
		this.dirs.push(dir);
		await Promise.resolve();
	}

	override append(filepath: string, lines: readonly string[]): Promise<void> {
		if (lines.length > 0) this.appends.push({ filepath, lines: [...lines] });
		return Promise.resolve();
	}

	override drain(): Promise<void> {
		return Promise.resolve();
	}
}

function docEvent(ts: number, sessionId = 's1'): DeltaEvent {
	return {
		type: 'doc-change',
		ts,
		sessionId,
		notePath: 'A.md',
		fromA: 0,
		toA: 0,
		fromB: 0,
		toB: 1,
		insertedText: 'x',
		deletedText: '',
		userEvent: 'input.type',
		noteType: null,
		vaultFolder: '',
	};
}

function sessionEnd(ts: number, sessionId = 's1'): DeltaEvent {
	return {
		type: 'session-end',
		ts,
		sessionId,
		notePath: 'A.md',
		reason: 'idle',
	};
}

describe('Persister', () => {
	it('buckets events by local-time day across two days', async () => {
		const buf = new RingBuffer(100);
		const writer = new CapturingWriter();
		const persister = new Persister(buf, { storageDirectory: '/tmp/x', writer });
		persister.start(0); // no interval — flush manually

		const day1 = new Date(2026, 4, 19, 10, 0, 0).getTime();
		const day2 = new Date(2026, 4, 20, 0, 30, 0).getTime();
		buf.push(docEvent(day1));
		buf.push(docEvent(day1 + 1));
		buf.push(docEvent(day2));

		await persister.flush();

		expect(writer.dirs).toEqual(['/tmp/x']);
		expect(writer.appends).toHaveLength(2);
		const files = writer.appends.map((a) => a.filepath).sort();
		expect(files[0]?.endsWith('2026-05-19.ndjson')).toBe(true);
		expect(files[1]?.endsWith('2026-05-20.ndjson')).toBe(true);
	});

	it('flushes immediately on session-end without waiting for the interval', async () => {
		const buf = new RingBuffer(100);
		const writer = new CapturingWriter();
		const persister = new Persister(buf, { storageDirectory: '/tmp/x', writer });
		persister.start(0);

		const ts = new Date(2026, 4, 19, 10, 0, 0).getTime();
		buf.push(docEvent(ts));
		expect(persister.pendingCount).toBe(1);
		expect(writer.appends).toHaveLength(0);

		buf.push(sessionEnd(ts + 100));
		// Subscribe callback already kicked off flush; await microtasks.
		await Promise.resolve();
		await Promise.resolve();

		expect(persister.pendingCount).toBe(0);
		expect(writer.appends.length).toBeGreaterThanOrEqual(1);
		const allLines = writer.appends.flatMap((a) => a.lines);
		const parsed = allLines.map((l) => JSON.parse(l) as DeltaEvent);
		expect(parsed.map((e) => e.type)).toEqual(['doc-change', 'session-end']);
	});

	it('ensureDir is called once across multiple flushes', async () => {
		const buf = new RingBuffer(100);
		const writer = new CapturingWriter();
		const persister = new Persister(buf, { storageDirectory: '/tmp/x', writer });
		persister.start(0);

		const ts = new Date(2026, 4, 19, 10, 0, 0).getTime();
		buf.push(docEvent(ts));
		await persister.flush();
		buf.push(docEvent(ts + 1));
		await persister.flush();

		expect(writer.dirs).toEqual(['/tmp/x']);
	});

	it('stop drains pending and unsubscribes from the buffer', async () => {
		const buf = new RingBuffer(100);
		const writer = new CapturingWriter();
		const persister = new Persister(buf, { storageDirectory: '/tmp/x', writer });
		persister.start(0);

		const ts = new Date(2026, 4, 19, 10, 0, 0).getTime();
		buf.push(docEvent(ts));
		await persister.stop();

		expect(persister.pendingCount).toBe(0);
		// After stop, further buffer pushes are not picked up.
		buf.push(docEvent(ts + 1));
		expect(persister.pendingCount).toBe(0);
	});

	it('serializes each event as a JSON line containing all schema fields', async () => {
		const buf = new RingBuffer(100);
		const writer = new CapturingWriter();
		const persister = new Persister(buf, { storageDirectory: '/tmp/x', writer });
		persister.start(0);

		const ts = new Date(2026, 4, 19, 10, 0, 0).getTime();
		buf.push(docEvent(ts));
		await persister.flush();

		expect(writer.appends).toHaveLength(1);
		const line = writer.appends[0]?.lines[0];
		expect(line).toBeDefined();
		const parsed = JSON.parse(line as string) as DeltaEvent;
		expect(parsed).toMatchObject({
			type: 'doc-change',
			ts,
			sessionId: 's1',
			notePath: 'A.md',
			insertedText: 'x',
			userEvent: 'input.type',
		});
	});

	it('storageDirectory exposes the resolved directory', () => {
		const buf = new RingBuffer(100);
		const persister = new Persister(buf, {
			storageDirectory: 'D:/explicit',
			writer: new CapturingWriter(),
		});
		expect(persister.storageDirectory).toBe('D:/explicit');
	});
});

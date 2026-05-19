import { describe, expect, it, vi } from 'vitest';

import { RingBuffer } from '../buffer';
import type { DeltaEvent } from '../events';

function evt(ts: number): DeltaEvent {
	return {
		type: 'session-start',
		ts,
		sessionId: `s_${ts}`,
		notePath: 'note.md',
	};
}

describe('RingBuffer', () => {
	it('rejects non-positive capacity', () => {
		expect(() => new RingBuffer(0)).toThrow();
		expect(() => new RingBuffer(-1)).toThrow();
	});

	it('accumulates up to capacity', () => {
		const buf = new RingBuffer(3);
		buf.push(evt(1));
		buf.push(evt(2));
		expect(buf.length).toBe(2);
		expect(buf.snapshot().map((e) => e.ts)).toEqual([1, 2]);
	});

	it('overwrites oldest events past capacity', () => {
		const buf = new RingBuffer(3);
		for (const t of [1, 2, 3, 4, 5]) buf.push(evt(t));
		expect(buf.length).toBe(3);
		expect(buf.snapshot().map((e) => e.ts)).toEqual([3, 4, 5]);
	});

	it('drain returns all events and empties the buffer', () => {
		const buf = new RingBuffer(3);
		buf.push(evt(1));
		buf.push(evt(2));
		const drained = buf.drain();
		expect(drained.map((e) => e.ts)).toEqual([1, 2]);
		expect(buf.length).toBe(0);
		expect(buf.snapshot()).toEqual([]);
	});

	it('notifies subscribers on push', () => {
		const buf = new RingBuffer(3);
		const seen: number[] = [];
		buf.subscribe((e) => seen.push(e.ts));
		buf.push(evt(10));
		buf.push(evt(11));
		expect(seen).toEqual([10, 11]);
	});

	it('subscriber errors do not interrupt push or other listeners', () => {
		const buf = new RingBuffer(3);
		const seen: number[] = [];
		buf.subscribe(() => {
			throw new Error('listener boom');
		});
		buf.subscribe((e) => seen.push(e.ts));
		expect(() => buf.push(evt(1))).not.toThrow();
		expect(seen).toEqual([1]);
	});

	it('unsubscribe stops further notifications', () => {
		const buf = new RingBuffer(3);
		const listener = vi.fn();
		const unsub = buf.subscribe(listener);
		buf.push(evt(1));
		unsub();
		buf.push(evt(2));
		expect(listener).toHaveBeenCalledTimes(1);
	});
});

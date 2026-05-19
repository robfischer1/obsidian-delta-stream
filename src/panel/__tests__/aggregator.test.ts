import { describe, expect, it } from 'vitest';

import { aggregate } from '../aggregator';
import type { DeltaEvent } from '../../capture/events';

function start(ts: number, sessionId: string, notePath: string): DeltaEvent {
	return { type: 'session-start', ts, sessionId, notePath };
}

function end(
	ts: number,
	sessionId: string,
	notePath: string,
	reason: 'idle' | 'blur' | 'note-switch' | 'unload',
): DeltaEvent {
	return { type: 'session-end', ts, sessionId, notePath, reason };
}

function doc(
	ts: number,
	sessionId: string,
	notePath: string,
	{
		insert = '',
		del = '',
		userEvent = 'input.type',
		fromA = 0,
		toA = 0,
		fromB = 0,
		toB = 0,
	}: {
		insert?: string;
		del?: string;
		userEvent?: string | null;
		fromA?: number;
		toA?: number;
		fromB?: number;
		toB?: number;
	} = {},
): DeltaEvent {
	return {
		type: 'doc-change',
		ts,
		sessionId,
		notePath,
		fromA,
		toA,
		fromB,
		toB,
		insertedText: insert,
		deletedText: del,
		userEvent,
		noteType: null,
		vaultFolder: null,
	};
}

describe('aggregate', () => {
	it('returns an empty arc when there are no events', () => {
		const arc = aggregate([], 'Notes/x.md');
		expect(arc.sessionCount).toBe(0);
		expect(arc.totalInsertedChars).toBe(0);
		expect(arc.rewriteRatio).toBe(0);
	});

	it('computes aggregates for a single session matching phdb writing_sessions logic', () => {
		const events: DeltaEvent[] = [
			start(100, 's1', 'A.md'),
			doc(200, 's1', 'A.md', { insert: 'hello', userEvent: 'input.type' }),
			doc(300, 's1', 'A.md', { insert: ' world', userEvent: 'input.type' }),
			doc(400, 's1', 'A.md', { del: 'd', userEvent: 'delete.backward' }),
			doc(500, 's1', 'A.md', { insert: '!', userEvent: 'input.paste' }),
			doc(600, 's1', 'A.md', { del: '!', userEvent: 'undo' }),
			end(800, 's1', 'A.md', 'blur'),
		];
		const arc = aggregate(events, 'A.md');
		expect(arc.sessionCount).toBe(1);
		const s = arc.sessions[0];
		expect(s).toBeDefined();
		if (s === undefined) throw new Error('no session');
		expect(s.startedAt).toBe(100);
		expect(s.endedAt).toBe(800);
		expect(s.endedReason).toBe('blur');
		expect(s.durationMs).toBe(700);
		expect(s.docChangeCount).toBe(5);
		expect(s.insertCount).toBe(3);
		expect(s.deleteCount).toBe(2);
		expect(s.totalInsertedChars).toBe(12);
		expect(s.totalDeletedChars).toBe(2);
		expect(s.undoCount).toBe(1);
		expect(s.pasteCount).toBe(1);
		expect(s.rewriteRatio).toBe(Math.round((2 / 12) * 1000) / 1000);
		expect(s.reversals.map((r) => r.userEvent)).toEqual(['input.paste', 'undo']);
	});

	it('filters by notePath', () => {
		const events: DeltaEvent[] = [
			start(100, 's1', 'A.md'),
			doc(200, 's1', 'A.md', { insert: 'a' }),
			start(300, 's2', 'B.md'),
			doc(400, 's2', 'B.md', { insert: 'b' }),
		];
		const arcA = aggregate(events, 'A.md');
		const arcB = aggregate(events, 'B.md');
		expect(arcA.sessionCount).toBe(1);
		expect(arcA.sessions[0]?.sessionId).toBe('s1');
		expect(arcB.sessionCount).toBe(1);
		expect(arcB.sessions[0]?.sessionId).toBe('s2');
	});

	it('sorts sessions most-recent-first', () => {
		const events: DeltaEvent[] = [
			start(100, 'old', 'A.md'),
			doc(150, 'old', 'A.md', { insert: 'x' }),
			start(500, 'new', 'A.md'),
			doc(550, 'new', 'A.md', { insert: 'y' }),
		];
		const arc = aggregate(events, 'A.md');
		expect(arc.sessions.map((s) => s.sessionId)).toEqual(['new', 'old']);
	});

	it('skips note-switch events and sessionless events', () => {
		const events: DeltaEvent[] = [
			{
				type: 'note-switch',
				ts: 100,
				sessionId: '',
				notePath: 'A.md',
				fromPath: null,
				toPath: 'A.md',
			},
			start(200, 's1', 'A.md'),
			doc(300, 's1', 'A.md', { insert: 'x' }),
		];
		const arc = aggregate(events, 'A.md');
		expect(arc.sessionCount).toBe(1);
	});

	it('drops accumulators with no notePath even if events have a sessionId', () => {
		const events: DeltaEvent[] = [
			// A session-end without notePath shouldn't materialise a session.
			{
				type: 'session-end',
				ts: 100,
				sessionId: 's1',
				notePath: null,
				reason: 'blur',
			},
		];
		const arc = aggregate(events);
		expect(arc.sessionCount).toBe(0);
	});

	it('overall rewrite_ratio uses corpus totals not session-averaged values', () => {
		const events: DeltaEvent[] = [
			start(100, 's1', 'A.md'),
			doc(200, 's1', 'A.md', { insert: 'aaaa' }), // 4 in
			doc(300, 's1', 'A.md', { del: 'a' }), // 1 out
			start(400, 's2', 'A.md'),
			doc(500, 's2', 'A.md', { insert: 'b' }), // 1 in
			doc(600, 's2', 'A.md', { del: 'bbb' }), // 3 out
		];
		const arc = aggregate(events, 'A.md');
		// Total: 5 in, 4 out → 0.800
		expect(arc.totalInsertedChars).toBe(5);
		expect(arc.totalDeletedChars).toBe(4);
		expect(arc.rewriteRatio).toBe(0.8);
	});

	it('ongoing session has null endedAt and null durationMs', () => {
		const events: DeltaEvent[] = [
			start(100, 's1', 'A.md'),
			doc(200, 's1', 'A.md', { insert: 'x' }),
		];
		const arc = aggregate(events, 'A.md');
		const s = arc.sessions[0];
		if (s === undefined) throw new Error('no session');
		expect(s.endedAt).toBeNull();
		expect(s.durationMs).toBeNull();
	});
});

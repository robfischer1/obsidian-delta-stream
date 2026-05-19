import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';

import { extractDocChangeEvents, type ChangeContext } from '../changes';
import type { DocChangeEvent } from '../events';

const ctx: ChangeContext = {
	sessionId: 'sess_test',
	notePath: 'Notes/Hello.md',
	noteType: 'Atom',
	vaultFolder: 'Notes',
	captureDeletedText: true,
};

describe('extractDocChangeEvents', () => {
	it('emits a single doc-change event for a single insertion', () => {
		const start = EditorState.create({ doc: 'hello world' });
		const tr = start.update({ changes: { from: 5, to: 5, insert: '!' } });
		const events = extractDocChangeEvents(
			{ changes: tr.changes, startDoc: start.doc, userEvent: 'input.type' },
			ctx,
			1_000,
		);
		expect(events).toEqual<DocChangeEvent[]>([
			{
				type: 'doc-change',
				ts: 1_000,
				sessionId: 'sess_test',
				notePath: 'Notes/Hello.md',
				fromA: 5,
				toA: 5,
				fromB: 5,
				toB: 6,
				insertedText: '!',
				deletedText: '',
				userEvent: 'input.type',
				noteType: 'Atom',
				vaultFolder: 'Notes',
			},
		]);
	});

	it('captures deleted text when captureDeletedText is true', () => {
		const start = EditorState.create({ doc: 'hello world' });
		const tr = start.update({ changes: { from: 0, to: 5 } });
		const events = extractDocChangeEvents(
			{ changes: tr.changes, startDoc: start.doc, userEvent: 'delete.selection' },
			ctx,
			500,
		);
		expect(events).toHaveLength(1);
		expect(events[0]?.deletedText).toBe('hello');
		expect(events[0]?.insertedText).toBe('');
	});

	it('omits deleted text when captureDeletedText is false', () => {
		const start = EditorState.create({ doc: 'hello world' });
		const tr = start.update({ changes: { from: 0, to: 5 } });
		const events = extractDocChangeEvents(
			{ changes: tr.changes, startDoc: start.doc, userEvent: null },
			{ ...ctx, captureDeletedText: false },
			500,
		);
		expect(events[0]?.deletedText).toBe('');
		expect(events[0]?.fromA).toBe(0);
		expect(events[0]?.toA).toBe(5);
	});

	it('emits one event per change when a transaction carries multiple changes', () => {
		const start = EditorState.create({ doc: 'abcdef' });
		const tr = start.update({
			changes: [
				{ from: 0, to: 1, insert: 'A' },
				{ from: 3, to: 3, insert: 'X' },
			],
		});
		const events = extractDocChangeEvents(
			{ changes: tr.changes, startDoc: start.doc, userEvent: null },
			ctx,
			0,
		);
		expect(events).toHaveLength(2);
		expect(events.map((e) => ({ from: e.fromA, ins: e.insertedText, del: e.deletedText }))).toEqual([
			{ from: 0, ins: 'A', del: 'a' },
			{ from: 3, ins: 'X', del: '' },
		]);
	});

	it('produces a correct event stream for a scripted type → backspace → paste sequence', () => {
		// This is the Phase 2 deliverable check — a scripted edit sequence.
		const events: DocChangeEvent[] = [];
		let state = EditorState.create({ doc: '' });

		let tr = state.update({ changes: { from: 0, to: 0, insert: 'hi' } });
		events.push(
			...extractDocChangeEvents(
				{ changes: tr.changes, startDoc: state.doc, userEvent: 'input.type' },
				ctx,
				100,
			),
		);
		state = tr.state;

		tr = state.update({ changes: { from: 1, to: 2 } });
		events.push(
			...extractDocChangeEvents(
				{ changes: tr.changes, startDoc: state.doc, userEvent: 'delete.backward' },
				ctx,
				200,
			),
		);
		state = tr.state;

		tr = state.update({ changes: { from: 1, to: 1, insert: 'ello' } });
		events.push(
			...extractDocChangeEvents(
				{ changes: tr.changes, startDoc: state.doc, userEvent: 'input.paste' },
				ctx,
				300,
			),
		);
		state = tr.state;

		expect(state.doc.toString()).toBe('hello');
		expect(
			events.map((e) => ({
				ts: e.ts,
				ue: e.userEvent,
				ins: e.insertedText,
				del: e.deletedText,
			})),
		).toEqual([
			{ ts: 100, ue: 'input.type', ins: 'hi', del: '' },
			{ ts: 200, ue: 'delete.backward', ins: '', del: 'i' },
			{ ts: 300, ue: 'input.paste', ins: 'ello', del: '' },
		]);
	});

	it('captures a highlight-then-replace as a single event with both inserted and deleted text', () => {
		const start = EditorState.create({ doc: 'foo bar baz' });
		const tr = start.update({ changes: { from: 4, to: 7, insert: 'QUX' } });
		const events = extractDocChangeEvents(
			{ changes: tr.changes, startDoc: start.doc, userEvent: 'input.replace' },
			ctx,
			0,
		);
		expect(events).toHaveLength(1);
		expect(events[0]?.deletedText).toBe('bar');
		expect(events[0]?.insertedText).toBe('QUX');
		expect(tr.state.doc.toString()).toBe('foo QUX baz');
	});

});

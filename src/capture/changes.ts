/**
 * Pure delta extraction. Operates on minimal CM6 types so it is testable
 * without an EditorView / ViewUpdate (those require a live DOM).
 *
 * The ViewPlugin (`view-plugin.ts`) adapts a real `ViewUpdate` into this
 * thinner input.
 */

import type { ChangeSet, Text } from '@codemirror/state';
import type { DocChangeEvent, SelectionChangeEvent } from './events';

export interface ChangeContext {
	sessionId: string;
	notePath: string;
	noteType: string | null;
	vaultFolder: string | null;
	captureDeletedText: boolean;
}

export interface DocChangeInput {
	changes: ChangeSet;
	startDoc: Text;
	/** CM6 Transaction.userEvent (`input.type`, `delete.backward`, `input.paste`, …) or null. */
	userEvent: string | null;
}

export function extractDocChangeEvents(
	input: DocChangeInput,
	ctx: ChangeContext,
	now: number,
): DocChangeEvent[] {
	const events: DocChangeEvent[] = [];
	input.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
		const deletedText =
			ctx.captureDeletedText && toA > fromA ? input.startDoc.sliceString(fromA, toA) : '';
		events.push({
			type: 'doc-change',
			ts: now,
			sessionId: ctx.sessionId,
			notePath: ctx.notePath,
			fromA,
			toA,
			fromB,
			toB,
			insertedText: inserted.toString(),
			deletedText,
			userEvent: input.userEvent,
			noteType: ctx.noteType,
			vaultFolder: ctx.vaultFolder,
		});
	});
	return events;
}

export interface SelectionRange {
	anchor: number;
	head: number;
}

export function makeSelectionChangeEvent(
	ranges: readonly SelectionRange[],
	sessionId: string,
	notePath: string,
	now: number,
): SelectionChangeEvent {
	return {
		type: 'selection-change',
		ts: now,
		sessionId,
		notePath,
		ranges: ranges.map((r) => ({ anchor: r.anchor, head: r.head })),
	};
}

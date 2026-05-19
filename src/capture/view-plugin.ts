/**
 * CodeMirror 6 ViewPlugin adapter — the thin layer that turns each `ViewUpdate`
 * into pure inputs for `changes.ts` and hands the resulting events to the
 * dispatcher.
 *
 * The dispatcher owns Obsidian-facing state (active file, settings, session
 * tracker, ring buffer). The view-plugin owns nothing — it is a re-entrant
 * adapter so tests can substitute a fake dispatcher.
 */

import { ViewPlugin, type PluginValue, type ViewUpdate } from '@codemirror/view';
import { Transaction, type Extension } from '@codemirror/state';

import type { ChangeContext } from './changes';
import { extractDocChangeEvents, makeSelectionChangeEvent } from './changes';
import type { DeltaEvent } from './events';

export interface CaptureDispatcher {
	/** Returns a context if capture is enabled for the current view, null otherwise. */
	contextFor(): ChangeContext | null;
	emit(events: DeltaEvent[]): void;
	now(): number;
}

export function makeCaptureExtension(dispatcher: CaptureDispatcher): Extension {
	return ViewPlugin.fromClass(
		class implements PluginValue {
			update(update: ViewUpdate) {
				if (!update.docChanged && !update.selectionSet) return;
				const ctx = dispatcher.contextFor();
				if (ctx === null) return;
				const now = dispatcher.now();
				const events: DeltaEvent[] = [];

				if (update.docChanged) {
					const userEvent = readUserEvent(update);
					events.push(
						...extractDocChangeEvents(
							{
								changes: update.changes,
								startDoc: update.startState.doc,
								userEvent,
							},
							ctx,
							now,
						),
					);
				}

				if (update.selectionSet && !update.docChanged) {
					events.push(
						makeSelectionChangeEvent(
							update.state.selection.ranges,
							ctx.sessionId,
							ctx.notePath,
							now,
						),
					);
				}

				if (events.length > 0) dispatcher.emit(events);
			}
		},
	);
}

function readUserEvent(update: ViewUpdate): string | null {
	for (const tr of update.transactions) {
		const ue = tr.annotation(Transaction.userEvent);
		if (typeof ue === 'string' && ue.length > 0) return ue;
	}
	return null;
}

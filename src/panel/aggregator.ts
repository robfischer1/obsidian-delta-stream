/**
 * Pure aggregator — `DeltaEvent[]` → `ArcSummary`.
 *
 * Mirrors the per-session aggregates in `personal-history-db`'s
 * `writing_sessions` table so the panel computes the same view phdb does,
 * just without the DB round-trip. Source of truth for the format is the
 * plugin's own NDJSON output.
 */

import type {
	DeltaEvent,
	DocChangeEvent,
	SelectionChangeEvent,
} from '../capture/events';

export interface SessionSummary {
	sessionId: string;
	notePath: string;
	startedAt: number;
	endedAt: number | null;
	endedReason: string | null;
	durationMs: number | null;
	docChangeCount: number;
	selectionChangeCount: number;
	insertCount: number;
	deleteCount: number;
	totalInsertedChars: number;
	totalDeletedChars: number;
	undoCount: number;
	pasteCount: number;
	rewriteRatio: number;
	/** doc-change events with userEvent='undo' or 'input.paste', arrival order. */
	reversals: DocChangeEvent[];
}

export interface ArcSummary {
	notePath: string;
	sessionCount: number;
	sessions: SessionSummary[];
	totalInsertedChars: number;
	totalDeletedChars: number;
	rewriteRatio: number;
}

interface SessionAccum {
	startedAt: number | null;
	endedAt: number | null;
	endedReason: string | null;
	notePath: string | null;
	deltas: DocChangeEvent[];
	selections: SelectionChangeEvent[];
	reversals: DocChangeEvent[];
}

function emptyAccum(): SessionAccum {
	return {
		startedAt: null,
		endedAt: null,
		endedReason: null,
		notePath: null,
		deltas: [],
		selections: [],
		reversals: [],
	};
}

/**
 * Group `events` into sessions and compute aggregates. If `filterNotePath`
 * is provided, only sessions whose notePath matches are included.
 *
 * Sessions are returned most-recent-first (sorted by startedAt DESC).
 */
export function aggregate(
	events: readonly DeltaEvent[],
	filterNotePath: string | null = null,
): ArcSummary {
	const accums = new Map<string, SessionAccum>();

	for (const event of events) {
		if (event.type === 'note-switch') continue;
		const sessionId = event.sessionId;
		if (sessionId === '') continue;

		let accum = accums.get(sessionId);
		if (accum === undefined) {
			accum = emptyAccum();
			accums.set(sessionId, accum);
		}

		// First non-empty notePath wins; doc-change events override since they
		// always carry it (selection-change does too, session-start/end too).
		if (accum.notePath === null && event.notePath !== null) {
			accum.notePath = event.notePath;
		}

		switch (event.type) {
			case 'session-start':
				accum.startedAt = event.ts;
				break;
			case 'session-end':
				accum.endedAt = event.ts;
				accum.endedReason = event.reason;
				break;
			case 'doc-change': {
				accum.deltas.push(event);
				if (event.userEvent === 'undo' || event.userEvent === 'input.paste') {
					accum.reversals.push(event);
				}
				if (accum.startedAt === null) accum.startedAt = event.ts;
				break;
			}
			case 'selection-change':
				accum.selections.push(event);
				if (accum.startedAt === null) accum.startedAt = event.ts;
				break;
		}
	}

	const sessions: SessionSummary[] = [];
	for (const [sessionId, accum] of accums) {
		if (accum.notePath === null || accum.startedAt === null) continue;
		if (filterNotePath !== null && accum.notePath !== filterNotePath) continue;

		let insertCount = 0;
		let deleteCount = 0;
		let totalInsertedChars = 0;
		let totalDeletedChars = 0;
		let undoCount = 0;
		let pasteCount = 0;
		for (const d of accum.deltas) {
			if (d.insertedText.length > 0) {
				insertCount++;
				totalInsertedChars += d.insertedText.length;
			}
			if (d.deletedText.length > 0) {
				deleteCount++;
				totalDeletedChars += d.deletedText.length;
			}
			if (d.userEvent === 'undo') undoCount++;
			if (d.userEvent === 'input.paste') pasteCount++;
		}
		const durationMs =
			accum.endedAt !== null ? accum.endedAt - accum.startedAt : null;
		const rewriteRatio =
			totalInsertedChars > 0 ? totalDeletedChars / totalInsertedChars : 0;

		sessions.push({
			sessionId,
			notePath: accum.notePath,
			startedAt: accum.startedAt,
			endedAt: accum.endedAt,
			endedReason: accum.endedReason,
			durationMs,
			docChangeCount: accum.deltas.length,
			selectionChangeCount: accum.selections.length,
			insertCount,
			deleteCount,
			totalInsertedChars,
			totalDeletedChars,
			undoCount,
			pasteCount,
			rewriteRatio: Math.round(rewriteRatio * 1000) / 1000,
			reversals: accum.reversals.slice(),
		});
	}

	sessions.sort((a, b) => b.startedAt - a.startedAt);

	const totalInsertedChars = sessions.reduce(
		(sum, s) => sum + s.totalInsertedChars,
		0,
	);
	const totalDeletedChars = sessions.reduce(
		(sum, s) => sum + s.totalDeletedChars,
		0,
	);
	const overallRatio =
		totalInsertedChars > 0 ? totalDeletedChars / totalInsertedChars : 0;

	return {
		notePath: filterNotePath ?? '',
		sessionCount: sessions.length,
		sessions,
		totalInsertedChars,
		totalDeletedChars,
		rewriteRatio: Math.round(overallRatio * 1000) / 1000,
	};
}

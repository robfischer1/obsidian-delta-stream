/**
 * Delta-stream event schema. Every event is JSON-serialisable so Phase 3 can
 * write events to NDJSON without an intermediate normaliser. The schema also
 * drives the Phase 5 phdb migration (`writing_sessions` + `writing_deltas`).
 */

export type DeltaEventType =
	| 'doc-change'
	| 'selection-change'
	| 'session-start'
	| 'session-end'
	| 'note-switch';

export type SessionEndReason = 'idle' | 'blur' | 'note-switch' | 'unload';

interface BaseEvent {
	type: DeltaEventType;
	/** Epoch milliseconds — Date.now() at emission. */
	ts: number;
	/** Empty string for events that pre-date or out-live a session (note-switch boundary). */
	sessionId: string;
	/** Vault-relative POSIX path of the active note, or null when no note is active. */
	notePath: string | null;
}

export interface DocChangeEvent extends BaseEvent {
	type: 'doc-change';
	/** Character offset bounds before / after the change. */
	fromA: number;
	toA: number;
	fromB: number;
	toB: number;
	insertedText: string;
	/** Empty when settings.captureDeletedText is false. */
	deletedText: string;
	/** CodeMirror Transaction.userEvent value, e.g. 'input.type', 'delete.backward', 'input.paste'. */
	userEvent: string | null;
	/** Frontmatter '@type', if present. */
	noteType: string | null;
	/** Vault-relative parent folder of the note. */
	vaultFolder: string | null;
}

export interface SelectionChangeEvent extends BaseEvent {
	type: 'selection-change';
	ranges: Array<{ anchor: number; head: number }>;
}

export interface SessionStartEvent extends BaseEvent {
	type: 'session-start';
}

export interface SessionEndEvent extends BaseEvent {
	type: 'session-end';
	reason: SessionEndReason;
}

export interface NoteSwitchEvent extends BaseEvent {
	type: 'note-switch';
	fromPath: string | null;
	toPath: string | null;
}

export type DeltaEvent =
	| DocChangeEvent
	| SelectionChangeEvent
	| SessionStartEvent
	| SessionEndEvent
	| NoteSwitchEvent;

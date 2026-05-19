/**
 * Integration test for LiveDispatcher — proves the load-bearing rules of
 * Phase 2: enabled=false → no events, excluded folder → no events,
 * note switch closes the current session, blur closes the current session,
 * unload closes the current session.
 */

import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import type { App, TFile } from 'obsidian';

import { LiveDispatcher } from '../dispatcher';
import { extractDocChangeEvents } from '../changes';
import { DEFAULT_SETTINGS, type DeltaStreamSettings } from '../../settings-types';
import type { DeltaEvent } from '../events';

function makeApp(metadata: Record<string, Record<string, unknown>> = {}): App {
	return {
		metadataCache: {
			getFileCache: (file: TFile) => {
				const fm = metadata[file.path];
				return fm !== undefined ? { frontmatter: fm } : null;
			},
		},
	} as unknown as App;
}

function stubFile(path: string, extension = 'md'): TFile {
	return { path, extension } as unknown as TFile;
}

function emitFromCtx(
	dispatcher: LiveDispatcher,
	docBefore: string,
	change: { from: number; to: number; insert?: string },
	now: () => number,
): void {
	const ctx = dispatcher.contextFor();
	if (ctx === null) return;
	const start = EditorState.create({ doc: docBefore });
	const tr = start.update({ changes: change });
	const events = extractDocChangeEvents(
		{ changes: tr.changes, startDoc: start.doc, userEvent: 'input.type' },
		ctx,
		now(),
	);
	dispatcher.emit(events);
}

function typesOf(events: DeltaEvent[]): string[] {
	return events.map((e) => e.type);
}

describe('LiveDispatcher', () => {
	it('emits zero events while settings.enabled is false', () => {
		const settings: DeltaStreamSettings = { ...DEFAULT_SETTINGS, enabled: false };
		const app = makeApp();
		const d = new LiveDispatcher(app, () => settings);

		d.setActiveFile(stubFile('Notes/A.md'));
		// Set active emits a note-switch boundary event but no session-start.
		const before = d.buffer.snapshot();
		expect(typesOf(before)).toEqual(['note-switch']);

		// contextFor returns null while disabled — emitting from it is a no-op.
		emitFromCtx(d, 'hello', { from: 5, to: 5, insert: '!' }, () => 1);
		expect(typesOf(d.buffer.snapshot())).toEqual(['note-switch']);
	});

	it('emits zero capture events for notes inside an excluded folder', () => {
		const settings: DeltaStreamSettings = {
			...DEFAULT_SETTINGS,
			enabled: true,
			excludedFolders: ['Outputs/The Tao of Rob'],
		};
		const app = makeApp();
		const d = new LiveDispatcher(app, () => settings);

		d.setActiveFile(stubFile('Outputs/The Tao of Rob/Beliefs.md'));
		emitFromCtx(d, 'hello', { from: 5, to: 5, insert: '!' }, () => 1);

		expect(typesOf(d.buffer.snapshot())).toEqual(['note-switch']);
	});

	it('emits session-start + doc-change for a captured edit and threads sessionId', () => {
		const settings: DeltaStreamSettings = {
			...DEFAULT_SETTINGS,
			enabled: true,
			captureDeletedText: true,
		};
		const app = makeApp({
			'Notes/A.md': { '@type': 'Observation' },
		});
		const d = new LiveDispatcher(app, () => settings);

		d.setActiveFile(stubFile('Notes/A.md'));
		emitFromCtx(d, 'hello', { from: 5, to: 5, insert: '!' }, () => 1_000);

		const events = d.buffer.snapshot();
		expect(typesOf(events)).toEqual(['note-switch', 'session-start', 'doc-change']);
		const start = events[1];
		const change = events[2];
		if (start?.type !== 'session-start' || change?.type !== 'doc-change') {
			throw new Error('unexpected event types');
		}
		expect(start.sessionId).toBe(change.sessionId);
		expect(start.sessionId.length).toBeGreaterThan(0);
		expect(change.notePath).toBe('Notes/A.md');
		expect(change.noteType).toBe('Observation');
		expect(change.vaultFolder).toBe('Notes');
		expect(change.insertedText).toBe('!');
	});

	it('closes the current session on note switch and reopens on the next edit', () => {
		const settings: DeltaStreamSettings = { ...DEFAULT_SETTINGS, enabled: true };
		const app = makeApp();
		const d = new LiveDispatcher(app, () => settings);

		d.setActiveFile(stubFile('A.md'));
		emitFromCtx(d, 'x', { from: 1, to: 1, insert: 'y' }, () => 100);

		d.setActiveFile(stubFile('B.md'));
		emitFromCtx(d, 'p', { from: 1, to: 1, insert: 'q' }, () => 200);

		const types = typesOf(d.buffer.snapshot());
		expect(types).toEqual([
			'note-switch', // initial seed → A.md
			'session-start',
			'doc-change',
			'session-end', // closed on note switch
			'note-switch', // A.md → B.md
			'session-start', // fresh session for B.md
			'doc-change',
		]);
		const events = d.buffer.snapshot();
		const firstEnd = events.find((e) => e.type === 'session-end');
		if (firstEnd?.type !== 'session-end') throw new Error('expected session-end');
		expect(firstEnd.reason).toBe('note-switch');
	});

	it('blur closes the current session with reason=blur', () => {
		const settings: DeltaStreamSettings = { ...DEFAULT_SETTINGS, enabled: true };
		const app = makeApp();
		const d = new LiveDispatcher(app, () => settings);

		d.setActiveFile(stubFile('A.md'));
		emitFromCtx(d, 'x', { from: 1, to: 1, insert: 'y' }, () => 100);
		d.handleBlur();

		const last = d.buffer.snapshot().at(-1);
		if (last?.type !== 'session-end') throw new Error('expected session-end');
		expect(last.reason).toBe('blur');
	});

	it('unload closes the current session with reason=unload', () => {
		const settings: DeltaStreamSettings = { ...DEFAULT_SETTINGS, enabled: true };
		const app = makeApp();
		const d = new LiveDispatcher(app, () => settings);

		d.setActiveFile(stubFile('A.md'));
		emitFromCtx(d, 'x', { from: 1, to: 1, insert: 'y' }, () => 100);
		d.handleUnload();

		const last = d.buffer.snapshot().at(-1);
		if (last?.type !== 'session-end') throw new Error('expected session-end');
		expect(last.reason).toBe('unload');
	});

	it('ignores non-markdown files', () => {
		const settings: DeltaStreamSettings = { ...DEFAULT_SETTINGS, enabled: true };
		const app = makeApp();
		const d = new LiveDispatcher(app, () => settings);

		d.setActiveFile(stubFile('image.png', 'png'));
		emitFromCtx(d, 'x', { from: 0, to: 0, insert: 'y' }, () => 1);

		expect(typesOf(d.buffer.snapshot())).toEqual(['note-switch']);
	});
});

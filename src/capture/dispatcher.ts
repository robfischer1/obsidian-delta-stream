/**
 * Obsidian-facing wiring. Owns the ring buffer, session tracker, and current
 * active file. Implements `CaptureDispatcher` so the CM6 extension can ask
 * "should I capture this update?" without knowing anything about Obsidian.
 */

import type { App, TFile } from 'obsidian';

import type { ChangeContext } from './changes';
import type { DeltaEvent, SessionEndReason } from './events';
import { isPathExcluded } from './exclusion';
import { RingBuffer } from './buffer';
import { SessionTracker } from './session';
import type { CaptureDispatcher } from './view-plugin';
import type { DeltaStreamSettings } from '../settings-types';

export class LiveDispatcher implements CaptureDispatcher {
	readonly buffer: RingBuffer;
	private readonly sessions: SessionTracker;
	private currentFile: TFile | null = null;

	constructor(
		private readonly app: App,
		private readonly getSettings: () => DeltaStreamSettings,
		bufferCapacity = 10_000,
	) {
		this.buffer = new RingBuffer(bufferCapacity);
		this.sessions = new SessionTracker(this.getSettings().idleSessionGapMs, (closedId) =>
			this.emitSessionEnd(closedId, 'idle'),
		);
	}

	setActiveFile(file: TFile | null): void {
		const prevPath = this.currentFile?.path ?? null;
		const nextPath = file?.path ?? null;
		if (prevPath === nextPath) return;
		this.closeSession('note-switch');
		this.buffer.push({
			type: 'note-switch',
			ts: this.now(),
			sessionId: '',
			notePath: nextPath,
			fromPath: prevPath,
			toPath: nextPath,
		});
		this.currentFile = file;
	}

	handleBlur(): void {
		this.closeSession('blur');
	}

	handleUnload(): void {
		this.closeSession('unload');
	}

	contextFor(): ChangeContext | null {
		const s = this.getSettings();
		if (!s.enabled) return null;
		const file = this.currentFile;
		if (file === null) return null;
		if (file.extension !== 'md') return null;
		if (isPathExcluded(file.path, s.excludedFolders)) return null;

		const now = this.now();
		const { sessionId, started } = this.sessions.touch(now);
		if (started) {
			this.buffer.push({
				type: 'session-start',
				ts: now,
				sessionId,
				notePath: file.path,
			});
		}
		return {
			sessionId,
			notePath: file.path,
			noteType: this.frontmatterType(file),
			vaultFolder: parentFolder(file.path),
			captureDeletedText: s.captureDeletedText,
		};
	}

	emit(events: DeltaEvent[]): void {
		for (const e of events) this.buffer.push(e);
	}

	now(): number {
		return Date.now();
	}

	private closeSession(reason: SessionEndReason): void {
		const id = this.sessions.close();
		if (id !== null) this.emitSessionEnd(id, reason);
	}

	private emitSessionEnd(sessionId: string, reason: SessionEndReason): void {
		this.buffer.push({
			type: 'session-end',
			ts: this.now(),
			sessionId,
			notePath: this.currentFile?.path ?? null,
			reason,
		});
	}

	private frontmatterType(file: TFile): string | null {
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter as Record<string, unknown> | undefined;
		if (fm === undefined) return null;
		const t = fm['@type'];
		return typeof t === 'string' ? t : null;
	}
}

function parentFolder(path: string): string {
	const idx = path.lastIndexOf('/');
	return idx >= 0 ? path.slice(0, idx) : '';
}

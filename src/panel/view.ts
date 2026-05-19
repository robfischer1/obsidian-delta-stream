/**
 * Writing-arc panel — Obsidian `ItemView` showing the captured editing
 * history of the active note. Reads NDJSON from disk (per Phase 7's
 * locked transport call) plus the in-memory ring buffer for live updates.
 */

import { ItemView, type WorkspaceLeaf, MarkdownView, setIcon } from 'obsidian';

import type DeltaStreamPlugin from '../main';
import type { DeltaEvent } from '../capture/events';
import { aggregate, type ArcSummary, type SessionSummary } from './aggregator';
import { readRecentDays } from './storage-reader';
import {
	ellipsize,
	formatDuration,
	formatRelativeTime,
	formatRewriteRatio,
} from './format';

export const VIEW_TYPE_WRITING_ARC = 'obsidian-delta-stream-writing-arc';

const DEFAULT_DAYS_TO_SCAN = 7;

export class WritingArcView extends ItemView {
	private readonly plugin: DeltaStreamPlugin;
	private currentNotePath: string | null = null;
	private cachedHistorical: DeltaEvent[] = [];
	private daysScanned = 0;

	constructor(leaf: WorkspaceLeaf, plugin: DeltaStreamPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_WRITING_ARC;
	}

	getDisplayText(): string {
		return 'Writing arc';
	}

	getIcon(): string {
		return 'pencil-line';
	}

	async onOpen(): Promise<void> {
		const initialFile = this.app.workspace.getActiveFile();
		this.currentNotePath = initialFile?.path ?? null;
		await this.refresh();

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				const view = leaf?.view;
				const file = view instanceof MarkdownView ? view.file : null;
				const path = file?.path ?? null;
				if (path === this.currentNotePath) return;
				this.currentNotePath = path;
				void this.refresh();
			}),
		);
	}

	async refresh(): Promise<void> {
		const settings = this.plugin.settings;
		const result = await readRecentDays(
			settings.storageDirectory,
			DEFAULT_DAYS_TO_SCAN,
		);
		this.cachedHistorical = result.events;
		this.daysScanned = result.dayFilesRead;
		this.render();
	}

	render(): void {
		const container = this.containerEl.children[1];
		if (!container) return;
		container.empty();
		container.addClass('obsidian-delta-stream-panel');

		const header = container.createDiv({ cls: 'odsp-header' });
		const title = header.createDiv({ cls: 'odsp-title' });
		title.setText('Writing arc');
		const refreshBtn = header.createEl('button', { cls: 'odsp-refresh' });
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.setAttribute('aria-label', 'Refresh');
		refreshBtn.addEventListener('click', () => {
			void this.refresh();
		});

		if (this.currentNotePath === null) {
			container.createDiv({
				cls: 'odsp-empty',
				text: 'No active markdown note',
			});
			return;
		}

		const subtitle = container.createDiv({ cls: 'odsp-note-path' });
		subtitle.setText(this.currentNotePath);

		const liveEvents = this.plugin.dispatcher?.buffer.snapshot() ?? [];
		const allEvents = mergeEvents(this.cachedHistorical, liveEvents);

		const arc = aggregate(allEvents, this.currentNotePath);

		if (arc.sessionCount === 0) {
			const empty = container.createDiv({ cls: 'odsp-empty' });
			empty.setText('No captured sessions for this note.');
			const hint = container.createDiv({ cls: 'odsp-hint' });
			hint.setText(
				`Scanned ${this.daysScanned} day file${this.daysScanned === 1 ? '' : 's'}.` +
					(this.plugin.settings.enabled
						? ''
						: ' Capture is currently off — toggle it on in settings.'),
			);
			return;
		}

		this.renderTotals(container, arc);

		for (const session of arc.sessions) {
			this.renderSession(container, session);
		}

		const footer = container.createDiv({ cls: 'odsp-footer' });
		footer.setText(
			`${arc.sessionCount} session${arc.sessionCount === 1 ? '' : 's'} · ` +
				`scanned ${this.daysScanned} day file${this.daysScanned === 1 ? '' : 's'} · ` +
				`live buffer ${liveEvents.length} event${liveEvents.length === 1 ? '' : 's'}`,
		);
	}

	private renderTotals(parent: Element, arc: ArcSummary): void {
		const totals = parent.createDiv({ cls: 'odsp-totals' });
		totals.createSpan({
			cls: 'odsp-totals-row',
			text:
				`${arc.totalInsertedChars} chars in / ${arc.totalDeletedChars} chars out · ` +
				`rewrite ratio ${formatRewriteRatio(arc.rewriteRatio)}`,
		});
	}

	private renderSession(parent: Element, session: SessionSummary): void {
		const card = parent.createDiv({ cls: 'odsp-session' });

		const timing = card.createDiv({ cls: 'odsp-session-timing' });
		timing.setText(
			`${formatRelativeTime(session.startedAt)} · ${formatDuration(session.durationMs)}` +
				(session.endedReason ? ` · ${session.endedReason}` : ''),
		);

		const stats = card.createDiv({ cls: 'odsp-session-stats' });
		stats.setText(
			`${session.docChangeCount} changes · ` +
				`${session.totalInsertedChars} in · ` +
				`${session.totalDeletedChars} out · ` +
				`ratio ${formatRewriteRatio(session.rewriteRatio)}` +
				(session.undoCount > 0 ? ` · ${session.undoCount} undo` : '') +
				(session.pasteCount > 0 ? ` · ${session.pasteCount} paste` : ''),
		);

		if (session.reversals.length > 0) {
			const reversals = card.createDiv({ cls: 'odsp-reversals' });
			reversals.createDiv({
				cls: 'odsp-reversals-title',
				text: `Reversals (${session.reversals.length})`,
			});
			for (const r of session.reversals) {
				const text = r.userEvent === 'undo' ? r.deletedText : r.insertedText;
				const sign = r.userEvent === 'undo' ? '−' : '+';
				const row = reversals.createDiv({ cls: 'odsp-reversal' });
				row.setText(`${sign} ${r.userEvent}: ${ellipsize(text, 60)}`);
			}
		}
	}
}

/**
 * Merge historical (from disk) and live (from buffer) events, deduplicating
 * by (sessionId, ts, type, fromA, insertedText) — fingerprint that survives
 * write-then-readback. Order doesn't matter; the aggregator groups by session.
 */
function mergeEvents(
	historical: readonly DeltaEvent[],
	live: readonly DeltaEvent[],
): DeltaEvent[] {
	const seen = new Set<string>();
	const out: DeltaEvent[] = [];
	for (const list of [historical, live]) {
		for (const e of list) {
			const key = fingerprint(e);
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(e);
		}
	}
	return out;
}

function fingerprint(e: DeltaEvent): string {
	if (e.type === 'doc-change') {
		return `dc|${e.sessionId}|${e.ts}|${e.fromA}|${e.toA}|${e.insertedText.length}`;
	}
	if (e.type === 'selection-change') {
		return `sc|${e.sessionId}|${e.ts}`;
	}
	return `${e.type}|${e.sessionId}|${e.ts}`;
}

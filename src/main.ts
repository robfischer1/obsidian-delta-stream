import { MarkdownView, Notice, Plugin, type WorkspaceLeaf } from 'obsidian';

import { DeltaStreamSettings, DEFAULT_SETTINGS, DeltaStreamSettingTab } from './settings';
import { LiveDispatcher } from './capture/dispatcher';
import { makeCaptureExtension } from './capture/view-plugin';
import { Persister } from './persistence/persister';
import { VIEW_TYPE_WRITING_ARC, WritingArcView } from './panel/view';

export default class DeltaStreamPlugin extends Plugin {
	settings: DeltaStreamSettings = DEFAULT_SETTINGS;
	dispatcher: LiveDispatcher | null = null;
	private statusBarEl: HTMLElement | null = null;
	private persister: Persister | null = null;

	async onload() {
		await this.loadSettings();

		this.dispatcher = new LiveDispatcher(this.app, () => this.settings);

		// Phase 3 — wire the persister to drain the ring buffer to NDJSON.
		this.persister = new Persister(this.dispatcher.buffer, {
			storageDirectory: this.settings.storageDirectory,
			onError: (err) => {
				new Notice(`Delta stream write failed: ${err.message}`);
				console.error('obsidian-delta-stream persister error', err);
			},
		});
		this.persister.start(this.settings.flushIntervalMs);

		this.statusBarEl = this.addStatusBarItem();
		this.refreshStatusBar();

		this.addCommand({
			id: 'toggle-capture',
			name: 'Toggle writing delta capture',
			callback: async () => {
				this.settings.enabled = !this.settings.enabled;
				await this.saveSettings();
				this.refreshStatusBar();
			},
		});

		this.addSettingTab(new DeltaStreamSettingTab(this.app, this));

		// Phase 7 — register the writing-arc side panel.
		this.registerView(
			VIEW_TYPE_WRITING_ARC,
			(leaf: WorkspaceLeaf) => new WritingArcView(leaf, this),
		);
		this.addRibbonIcon('pencil-line', 'Open writing arc', async () => {
			await this.openWritingArcView();
		});
		this.addCommand({
			id: 'open-writing-arc',
			name: 'Open writing arc panel',
			callback: async () => {
				await this.openWritingArcView();
			},
		});

		// Phase 2 — register the CodeMirror 6 capture extension.
		this.registerEditorExtension(makeCaptureExtension(this.dispatcher));

		// Track the active markdown file so capture events carry the right notePath.
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf | null) => {
				const view = leaf?.view;
				const file = view instanceof MarkdownView ? view.file : null;
				this.dispatcher?.setActiveFile(file);
			}),
		);

		// Window blur closes the current session (Phase 0 Q12 — focus-loss is a session boundary).
		this.registerDomEvent(window, 'blur', () => {
			this.dispatcher?.handleBlur();
		});

		// Seed the dispatcher with the file that was already active at load time.
		this.app.workspace.onLayoutReady(() => {
			const initial = this.app.workspace.getActiveFile();
			this.dispatcher?.setActiveFile(initial);
		});
	}

	onunload() {
		// Close the active session first so the session-end event lands in the
		// buffer before the persister drains it.
		this.dispatcher?.handleUnload();
		// Fire-and-forget stop — Obsidian doesn't wait on async unload.
		void this.persister?.stop();
		this.persister = null;
		this.dispatcher = null;
		this.statusBarEl = null;
	}

	async loadSettings() {
		const stored = (await this.loadData()) as Partial<DeltaStreamSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async openWritingArcView(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_WRITING_ARC);
		if (existing.length > 0) {
			const target = existing[0];
			if (target !== undefined) {
				await workspace.revealLeaf(target);
				return;
			}
		}
		const leaf = workspace.getRightLeaf(false);
		if (leaf !== null) {
			await leaf.setViewState({ type: VIEW_TYPE_WRITING_ARC, active: true });
			await workspace.revealLeaf(leaf);
		}
	}

	refreshStatusBar(): void {
		if (this.statusBarEl === null) return;
		this.statusBarEl.toggleClass(
			'obsidian-delta-stream-hidden',
			!this.settings.showStatusBarIndicator,
		);
		this.statusBarEl.setText(
			this.settings.enabled ? 'Delta capture: on' : 'Delta capture: off',
		);
	}
}

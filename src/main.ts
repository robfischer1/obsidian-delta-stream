import { MarkdownView, Plugin, type WorkspaceLeaf } from 'obsidian';

import { DeltaStreamSettings, DEFAULT_SETTINGS, DeltaStreamSettingTab } from './settings';
import { LiveDispatcher } from './capture/dispatcher';
import { makeCaptureExtension } from './capture/view-plugin';

export default class DeltaStreamPlugin extends Plugin {
	settings: DeltaStreamSettings = DEFAULT_SETTINGS;
	private statusBarEl: HTMLElement | null = null;
	private dispatcher: LiveDispatcher | null = null;

	async onload() {
		await this.loadSettings();

		this.dispatcher = new LiveDispatcher(this.app, () => this.settings);

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
		this.dispatcher?.handleUnload();
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

	private refreshStatusBar() {
		if (this.statusBarEl === null) return;
		this.statusBarEl.setText(
			this.settings.enabled ? 'Delta capture: on' : 'Delta capture: off',
		);
	}
}

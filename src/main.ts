import { Plugin } from 'obsidian';
import { DeltaStreamSettings, DEFAULT_SETTINGS, DeltaStreamSettingTab } from './settings';

export default class DeltaStreamPlugin extends Plugin {
	settings: DeltaStreamSettings = DEFAULT_SETTINGS;
	private statusBarEl: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

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

		// Phase 2 (CodeMirror 6 capture extension) and Phase 3 (NDJSON persistence)
		// register the actual capture hooks. This shell does nothing on document
		// changes by design.
	}

	onunload() {
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
		if (!this.statusBarEl) return;
		this.statusBarEl.setText(
			this.settings.enabled ? 'Delta capture: on' : 'Delta capture: off',
		);
	}
}

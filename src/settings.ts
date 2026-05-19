import { App, PluginSettingTab, Setting } from 'obsidian';
import type DeltaStreamPlugin from './main';

export interface DeltaStreamSettings {
	/** Master enable/disable per vault. Off by default (Phase 0 Q1 + Q11). */
	enabled: boolean;
	/** Absolute path where per-day NDJSON files are written. Outside the vault by default (Phase 0 Q10). */
	storageDirectory: string;
	/** How often the in-memory ring buffer flushes to disk, in milliseconds. */
	flushIntervalMs: number;
	/** Inter-event idle gap that closes a writing session, in milliseconds (Phase 0 Q12). */
	idleSessionGapMs: number;
	/** Whether to record the actual deleted text in delta events (Phase 0 Q8). */
	captureDeletedText: boolean;
	/** Vault-relative folder paths that are never captured. Ships empty (Phase 0 Q11). */
	excludedFolders: string[];
	/** Show a capture-state indicator in the status bar. */
	showStatusBarIndicator: boolean;
}

export const DEFAULT_SETTINGS: DeltaStreamSettings = {
	enabled: false,
	storageDirectory: '',
	flushIntervalMs: 2_000,
	idleSessionGapMs: 5 * 60 * 1_000,
	captureDeletedText: true,
	excludedFolders: [],
	showStatusBarIndicator: true,
};

/**
 * Placeholder settings tab — wired enable/disable only.
 * Full controls (storage path, exclusions, idle threshold, never-draft shortcut)
 * arrive in Phase 4.
 */
export class DeltaStreamSettingTab extends PluginSettingTab {
	plugin: DeltaStreamPlugin;

	constructor(app: App, plugin: DeltaStreamPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Enable delta capture')
			.setDesc(
				'Capture editing deltas in this vault; off by default; full configuration arrives in a later phase.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabled)
					.onChange(async (value) => {
						this.plugin.settings.enabled = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}

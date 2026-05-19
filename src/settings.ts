import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type DeltaStreamPlugin from './main';
import { parseExcludedFolders, withNeverDraftFolders } from './settings-types';

export type { DeltaStreamSettings } from './settings-types';
export { DEFAULT_SETTINGS, NEVER_DRAFT_FOLDERS } from './settings-types';

/**
 * Settings tab. Live-effect settings (enable, captureDeletedText, exclusions,
 * status-bar visibility) take effect on save. Restart-required settings
 * (storage path, flush interval, idle gap) are flagged in their descriptions —
 * those are captured at plugin construction and changing them needs a reload
 * via "Disable + Enable" in Community plugins.
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

		new Setting(containerEl).setName('Capture').setHeading();

		new Setting(containerEl)
			.setName('Enable delta capture')
			.setDesc('Per-vault master switch; off by default.')
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enabled).onChange(async (v) => {
					this.plugin.settings.enabled = v;
					await this.plugin.saveSettings();
					this.plugin.refreshStatusBar();
				}),
			);

		new Setting(containerEl)
			.setName('Capture deleted text')
			.setDesc('Record the actual removed text in each delete event.')
			.addToggle((t) =>
				t.setValue(this.plugin.settings.captureDeletedText).onChange(async (v) => {
					this.plugin.settings.captureDeletedText = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Idle session gap (minutes)')
			.setDesc(
				'An idle gap of this many minutes closes the current writing session; requires plugin reload.',
			)
			.addText((t) =>
				t
					.setValue(String(this.plugin.settings.idleSessionGapMs / 60_000))
					.onChange(async (v) => {
						const n = Number(v);
						if (!Number.isFinite(n) || n <= 0) return;
						this.plugin.settings.idleSessionGapMs = n * 60_000;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Show status bar indicator')
			.setDesc('Display the capture on/off state in the status bar.')
			.addToggle((t) =>
				t.setValue(this.plugin.settings.showStatusBarIndicator).onChange(async (v) => {
					this.plugin.settings.showStatusBarIndicator = v;
					await this.plugin.saveSettings();
					this.plugin.refreshStatusBar();
				}),
			);

		new Setting(containerEl).setName('Storage').setHeading();

		new Setting(containerEl)
			.setName('Storage directory')
			.setDesc(
				'Absolute filesystem path for event log files; leave empty for the default (~/Obsidian/delta-stream-data); requires plugin reload.',
			)
			.addText((t) =>
				t.setValue(this.plugin.settings.storageDirectory).onChange(async (v) => {
					this.plugin.settings.storageDirectory = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Flush interval (seconds)')
			.setDesc(
				'How often the in-memory buffer flushes to disk; each session-end also flushes immediately; requires plugin reload.',
			)
			.addText((t) =>
				t
					.setValue(String(this.plugin.settings.flushIntervalMs / 1_000))
					.onChange(async (v) => {
						const n = Number(v);
						if (!Number.isFinite(n) || n <= 0) return;
						this.plugin.settings.flushIntervalMs = n * 1_000;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName('Privacy').setHeading();

		new Setting(containerEl)
			.setName('Excluded folders')
			.setDesc(
				'Vault-relative folder paths whose notes never emit capture events; one per line; takes effect immediately on save.',
			)
			.addTextArea((t) => {
				t.setValue(this.plugin.settings.excludedFolders.join('\n')).onChange(async (v) => {
					this.plugin.settings.excludedFolders = parseExcludedFolders(v);
					await this.plugin.saveSettings();
				});
				t.inputEl.rows = 6;
				t.inputEl.cols = 48;
			});

		new Setting(containerEl)
			.setName('Add never-draft folders')
			.setDesc(
				'Append the three never-draft folders to the exclusion list above (deduped).',
			)
			.addButton((b) =>
				b.setButtonText('Add never-draft folders').onClick(async () => {
					this.plugin.settings.excludedFolders = withNeverDraftFolders(
						this.plugin.settings.excludedFolders,
					);
					await this.plugin.saveSettings();
					new Notice('Added never-draft folders to the exclusion list');
					this.display();
				}),
			);
	}
}

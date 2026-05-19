import { App, PluginSettingTab, Setting } from 'obsidian';
import type DeltaStreamPlugin from './main';

export type { DeltaStreamSettings } from './settings-types';
export { DEFAULT_SETTINGS } from './settings-types';

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

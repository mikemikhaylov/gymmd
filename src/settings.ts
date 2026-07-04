import { type App, PluginSettingTab, Setting } from 'obsidian';
import type GymMDPlugin from './main';

export interface GymMDSettings {
	/**
	 * Root folder (relative to the vault) that holds all GymMD data:
	 * `<root>/workouts/…` and `<root>/body_weight.md`. Empty = vault root.
	 * The folder structure below the root is fixed (not configurable).
	 */
	rootPath: string;
}

export const DEFAULT_SETTINGS: GymMDSettings = {
	rootPath: '',
};

export class GymMDSettingTab extends PluginSettingTab {
	plugin: GymMDPlugin;

	constructor(app: App, plugin: GymMDPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Data folder')
			.setDesc(
				'Root folder for all workout and body-weight data. Leave empty for the vault root.',
			)
			.addText((text) =>
				text
					.setPlaceholder('Fitness')
					.setValue(this.plugin.settings.rootPath)
					.onChange(async (value) => {
						this.plugin.settings.rootPath = value.trim();
						await this.plugin.saveSettings();
					}),
			);
	}
}

import { type App, PluginSettingTab, Setting } from 'obsidian';
import type GymMDPlugin from './main';

export interface GymMDSettings {
	/** Base folder under the vault root that holds all GymMD data. */
	basePath: string;
	exercisesFolder: string;
	templatesFolder: string;
	activeFolder: string;
	completedFolder: string;
	abandonedFolder: string;
}

export const DEFAULT_SETTINGS: GymMDSettings = {
	basePath: 'Workouts',
	exercisesFolder: 'Exercises',
	templatesFolder: 'Templates',
	activeFolder: 'Active',
	completedFolder: 'Completed',
	abandonedFolder: 'Abandoned',
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
			.setName('Base folder')
			.setDesc('Vault folder that contains all workout data.')
			.addText((text) =>
				text
					.setPlaceholder('Workouts')
					.setValue(this.plugin.settings.basePath)
					.onChange(async (value) => {
						this.plugin.settings.basePath = value.trim() || 'Workouts';
						await this.plugin.saveSettings();
					}),
			);

		const subFolders: Array<[keyof GymMDSettings, string, string]> = [
			['exercisesFolder', 'Exercises sub-folder', 'Exercises'],
			['templatesFolder', 'Templates sub-folder', 'Templates'],
			['activeFolder', 'Active sub-folder', 'Active'],
			['completedFolder', 'Completed sub-folder', 'Completed'],
			['abandonedFolder', 'Abandoned sub-folder', 'Abandoned'],
		];

		for (const [key, name, fallback] of subFolders) {
			new Setting(containerEl).setName(name).addText((text) =>
				text
					.setPlaceholder(fallback)
					.setValue(this.plugin.settings[key])
					.onChange(async (value) => {
						this.plugin.settings[key] = value.trim() || fallback;
						await this.plugin.saveSettings();
					}),
			);
		}
	}
}

import { type App, PluginSettingTab, Setting } from 'obsidian';
import type GymMDPlugin from './main';

export interface GymMDSettings {
	/** Base folder under the vault root that holds all GymMD data. */
	basePath: string;
	exercisesFolder: string;
	templatesFolder: string;
	activeFolder: string;
	completedFolder: string;
	reportsFolder: string;
}

export const DEFAULT_SETTINGS: GymMDSettings = {
	basePath: 'workouts',
	exercisesFolder: 'exercises',
	templatesFolder: 'templates',
	activeFolder: 'active',
	completedFolder: 'completed',
	reportsFolder: 'reports',
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
					// Folder names are intentionally lowercase, not sentence-case prose.
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder('workouts')
					.setValue(this.plugin.settings.basePath)
					.onChange(async (value) => {
						this.plugin.settings.basePath = value.trim() || 'workouts';
						await this.plugin.saveSettings();
					}),
			);

		const subFolders: Array<[keyof GymMDSettings, string, string]> = [
			['exercisesFolder', 'Exercises sub-folder', 'exercises'],
			['templatesFolder', 'Templates sub-folder', 'templates'],
			['activeFolder', 'Active sub-folder', 'active'],
			['completedFolder', 'Completed sub-folder', 'completed'],
			['reportsFolder', 'Reports sub-folder', 'reports'],
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

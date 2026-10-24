import { type App, PluginSettingTab, Setting } from 'obsidian';
import type GymMDPlugin from './main';

/** Feature areas that can be hidden. Disabling one only hides its UI — data is untouched. */
export type ModuleId = 'strength' | 'journal' | 'bodyWeight';

export const MODULES: { id: ModuleId; name: string; desc: string }[] = [
	{
		id: 'strength',
		name: 'Strength training',
		desc: 'Templates, exercises, active workout, history and reports.',
	},
	{ id: 'journal', name: 'Journal', desc: 'Daily habits, recovery and symptoms.' },
	{ id: 'bodyWeight', name: 'Body weight', desc: 'Body-weight log.' },
];

export interface GymMDSettings {
	/**
	 * Root folder (relative to the vault) that holds all GymMD data:
	 * `<root>/workouts/…`, `<root>/journal/…` and `<root>/body_weight.md`. Empty = vault root.
	 * The folder structure below the root is fixed (not configurable).
	 */
	rootPath: string;
	/** Which modules are shown in the app (all enabled by default). */
	modules: Record<ModuleId, boolean>;
}

export const DEFAULT_SETTINGS: GymMDSettings = {
	rootPath: '',
	modules: { strength: true, journal: true, bodyWeight: true },
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
				'Root folder for all workout, body-weight and journal data. Leave empty for the vault root.',
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

		new Setting(containerEl)
			.setName('Modules')
			.setDesc("Hide parts of the app you don't use. Their data files are kept as they are.")
			.setHeading();
		for (const m of MODULES) {
			new Setting(containerEl)
				.setName(m.name)
				.setDesc(m.desc)
				.addToggle((toggle) =>
					toggle.setValue(this.plugin.settings.modules[m.id]).onChange(async (value) => {
						this.plugin.settings.modules = { ...this.plugin.settings.modules, [m.id]: value };
						await this.plugin.saveSettings();
					}),
				);
		}
	}
}

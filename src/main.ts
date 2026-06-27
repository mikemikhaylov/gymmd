import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, type GymMDSettings, GymMDSettingTab } from './settings';
import { ExerciseStore } from './services/exercise-store';
import { TemplateStore, type TemplateEntry } from './services/template-store';
import { WorkoutStore } from './services/workout-store';
import { resolvePaths, ensureFolders } from './services/paths';
import { VIEW_TYPE_APP } from './utils/constants';
import { GymMDView } from './ui/views/app-view';
import { chooseAction } from './ui/modals/prompts';

export default class GymMDPlugin extends Plugin {
	settings!: GymMDSettings;
	exercises!: ExerciseStore;
	templates!: TemplateStore;
	workouts!: WorkoutStore;

	async onload(): Promise<void> {
		await this.loadSettings();

		const getSettings = () => this.settings;
		this.exercises = new ExerciseStore(this.app, getSettings);
		this.templates = new TemplateStore(this.app, getSettings);
		this.workouts = new WorkoutStore(this.app, getSettings);

		this.registerView(VIEW_TYPE_APP, (leaf) => new GymMDView(leaf, this));

		// eslint-disable-next-line obsidianmd/ui/sentence-case -- "GymMD" is a brand name
		this.addRibbonIcon('dumbbell', 'Open GymMD', () => {
			void this.openApp();
		});

		this.addCommand({
			id: 'open-home',
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- "GymMD" is a brand name
			name: 'Open GymMD',
			callback: () => void this.openApp(),
		});

		this.addSettingTab(new GymMDSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<GymMDSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/** Reveal the GymMD app view, opening it if it isn't already present. */
	async openApp(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_APP)[0];
		if (!leaf) {
			leaf = workspace.getLeaf(true);
			await leaf.setViewState({ type: VIEW_TYPE_APP, active: true });
		}
		await workspace.revealLeaf(leaf);
	}

	/**
	 * Begin a workout from a template. Only one workout is active at a time;
	 * if one already exists, the in-app caller just navigates to it. Creation
	 * and folder setup happen here.
	 */
	async startWorkout(entry: TemplateEntry): Promise<void> {
		const active = await this.workouts.findActive();
		if (active) {
			await chooseAction(this.app, {
				title: 'Workout in progress',
				message:
					'A workout is already in progress. Finish it first — or delete its file in the active folder — before starting a new one.',
				actions: [{ id: 'resume', label: 'Resume current', cta: true }],
			});
			return;
		}

		await ensureFolders(this.app, resolvePaths(this.settings));
		await this.workouts.createFromTemplate(entry.template);
	}
}

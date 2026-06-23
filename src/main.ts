import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, type GymMDSettings, GymMDSettingTab } from './settings';
import { ExerciseStore } from './services/exercise-store';
import { TemplateStore, type TemplateEntry } from './services/template-store';
import { WorkoutStore } from './services/workout-store';
import { resolvePaths, ensureFolders } from './services/paths';
import {
	VIEW_TYPE_EXERCISES,
	VIEW_TYPE_TEMPLATES,
	VIEW_TYPE_ACTIVE_WORKOUT,
	VIEW_TYPE_HISTORY,
} from './utils/constants';
import { ExerciseListView } from './ui/views/exercise-list-view';
import { TemplateListView } from './ui/views/template-list-view';
import { ActiveWorkoutView } from './ui/views/active-workout-view';
import { HistoryView } from './ui/views/history-view';
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

		this.registerView(VIEW_TYPE_EXERCISES, (leaf) => new ExerciseListView(leaf, this));
		this.registerView(VIEW_TYPE_TEMPLATES, (leaf) => new TemplateListView(leaf, this));
		this.registerView(VIEW_TYPE_ACTIVE_WORKOUT, (leaf) => new ActiveWorkoutView(leaf, this));
		this.registerView(VIEW_TYPE_HISTORY, (leaf) => new HistoryView(leaf, this));

		this.addRibbonIcon('dumbbell', 'Open workout templates', () => {
			void this.activateView(VIEW_TYPE_TEMPLATES);
		});

		this.addCommand({
			id: 'open-templates',
			name: 'Open workout templates',
			callback: () => void this.activateView(VIEW_TYPE_TEMPLATES),
		});
		this.addCommand({
			id: 'open-exercises',
			name: 'Open exercises',
			callback: () => void this.activateView(VIEW_TYPE_EXERCISES),
		});
		this.addCommand({
			id: 'open-active-workout',
			name: 'Open active workout',
			callback: () => void this.activateView(VIEW_TYPE_ACTIVE_WORKOUT),
		});
		this.addCommand({
			id: 'open-history',
			name: 'Open workout history',
			callback: () => void this.activateView(VIEW_TYPE_HISTORY),
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

	/** Reveal (or open) a leaf for the given view type. */
	async activateView(type: string): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(type)[0];
		if (!leaf) {
			leaf = workspace.getLeaf(true);
			await leaf.setViewState({ type, active: true });
		}
		await workspace.revealLeaf(leaf);
	}

	/** Begin a workout from a template, handling an already-active workout. */
	async startWorkout(entry: TemplateEntry): Promise<void> {
		const active = await this.workouts.findActive();
		if (active) {
			// Only one active workout at a time. Finish the current one (or delete
			// its file in the active folder) before starting another.
			await chooseAction(this.app, {
				title: 'Workout in progress',
				message:
					'A workout is already in progress. Finish it first — or delete its file in the active folder — before starting a new one.',
				actions: [{ id: 'resume', label: 'Resume current', cta: true }],
			});
			await this.reopenActiveWorkout();
			return;
		}

		await ensureFolders(this.app, resolvePaths(this.settings));
		await this.workouts.createFromTemplate(entry.template);
		await this.reopenActiveWorkout();
	}

	/** Force a fresh Active Workout view so it reloads the current active file. */
	private async reopenActiveWorkout(): Promise<void> {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_ACTIVE_WORKOUT);
		await this.activateView(VIEW_TYPE_ACTIVE_WORKOUT);
	}
}

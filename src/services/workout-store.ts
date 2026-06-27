import { type App, TFile, normalizePath } from 'obsidian';
import type { Template, Workout } from '../types';
import { TYPE_WORKOUT } from '../utils/constants';
import { workoutId } from '../utils/id';
import { todayISODate, nowISODateTime } from '../utils/date';
import { resolvePaths, ensureFolders, uniquePath, sanitizeFileName } from './paths';
import { workoutFromFrontmatter } from './parse';
import { serializeWorkout } from './serializer';
import { renumberWorkout } from './summary';
import { filesIn, readTyped, writeFile, getFile } from './vault-io';
import type { GymMDSettings } from '../settings';

export interface WorkoutEntry {
	file: TFile;
	workout: Workout;
}

export class WorkoutStore {
	constructor(
		private app: App,
		private getSettings: () => GymMDSettings,
	) {}

	private paths() {
		return resolvePaths(this.getSettings());
	}

	/** The single in-progress workout, if any (Active/ holds 0 or 1). */
	async findActive(): Promise<WorkoutEntry | null> {
		for (const file of filesIn(this.app, this.paths().active)) {
			const workout = await readTyped(this.app, file, workoutFromFrontmatter);
			if (workout && workout.status === 'in_progress') return { file, workout };
		}
		return null;
	}

	async getByPath(path: string): Promise<WorkoutEntry | null> {
		const file = getFile(this.app, path);
		if (!file) return null;
		const workout = await readTyped(this.app, file, workoutFromFrontmatter);
		return workout ? { file, workout } : null;
	}

	async listCompleted(): Promise<WorkoutEntry[]> {
		const entries: WorkoutEntry[] = [];
		for (const file of filesIn(this.app, this.paths().completed)) {
			const workout = await readTyped(this.app, file, workoutFromFrontmatter);
			if (workout) entries.push({ file, workout });
		}
		// Filenames are date-prefixed (YYYY-MM-DD …), so this sorts newest-first.
		return entries.sort((a, b) => b.file.basename.localeCompare(a.file.basename));
	}

	async createFromTemplate(tpl: Template): Promise<WorkoutEntry> {
		const paths = this.paths();
		await ensureFolders(this.app, paths);
		const date = todayISODate();
		const workout: Workout = {
			type: TYPE_WORKOUT,
			workout_id: workoutId(),
			template_id: tpl.template_id,
			status: 'in_progress',
			started: nowISODateTime(),
			completed: null,
			current_phase_started: null,
			exercises: tpl.exercises.map((ex) => ({
				uid: ex.uid,
				exercise_id: ex.exercise_id,
				name: ex.name,
				order: ex.order,
				sets: ex.sets.map((s) => ({
					set: s.set,
					reps: s.reps,
					weight: s.weight,
					done: false,
					started: null,
					duration_seconds: null,
				})),
			})),
		};
		renumberWorkout(workout);

		const baseName = `${date} ${sanitizeFileName(tpl.name)}`;
		const path = uniquePath(this.app, paths.active, baseName);
		const file = await this.app.vault.create(path, serializeWorkout(workout, baseName));
		return { file, workout };
	}

	/** Autosave during a live workout. */
	async save(file: TFile, workout: Workout): Promise<void> {
		renumberWorkout(workout);
		await writeFile(this.app, file, serializeWorkout(workout, file.basename));
	}

	async finish(file: TFile, workout: Workout): Promise<TFile> {
		workout.status = 'completed';
		workout.completed = nowISODateTime();
		workout.current_phase_started = null;
		renumberWorkout(workout);
		return this.moveTo(file, workout, this.paths().completed);
	}

	private async moveTo(file: TFile, workout: Workout, folder: string): Promise<TFile> {
		await ensureFolders(this.app, this.paths());
		await writeFile(this.app, file, serializeWorkout(workout, file.basename));
		const target = uniquePath(this.app, folder, file.basename);
		await this.app.fileManager.renameFile(file, target);
		return getFile(this.app, normalizePath(target)) ?? file;
	}
}

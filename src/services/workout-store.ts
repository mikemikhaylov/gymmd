import { type App, TFile, normalizePath } from 'obsidian';
import type { Template, Workout } from '../types';
import { TYPE_WORKOUT } from '../utils/constants';
import { workoutId } from '../utils/id';
import { todayISODate, nowISODateTime, parseISODateTime } from '../utils/date';
import { resolvePaths, ensureFolders, uniquePath, sanitizeFileName } from './paths';
import { workoutFromFrontmatter } from './parse';
import { serializeWorkout } from './serializer';
import { recomputeWorkoutSummary } from './summary';
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
		return entries.sort((a, b) => b.workout.date.localeCompare(a.workout.date));
	}

	async createFromTemplate(tpl: Template): Promise<WorkoutEntry> {
		const paths = this.paths();
		await ensureFolders(this.app, paths);
		const date = todayISODate();
		const workout: Workout = {
			type: TYPE_WORKOUT,
			workout_id: workoutId(),
			template_id: tpl.template_id,
			template_name: tpl.name,
			status: 'in_progress',
			date,
			started: nowISODateTime(),
			completed: null,
			duration_minutes: null,
			current_phase_started: null,
			exercise_count: tpl.exercises.length,
			total_sets_planned: 0,
			total_sets_completed: 0,
			total_volume_kg: 0,
			exercises: tpl.exercises.map((ex) => ({
				exercise_id: ex.exercise_id,
				name: ex.name,
				order: ex.order,
				sets: ex.sets.map((s) => ({
					set: s.set,
					planned_reps: s.reps,
					planned_weight: s.weight,
					reps: null,
					weight: null,
					done: false,
					started: null,
					duration_seconds: null,
				})),
			})),
		};
		recomputeWorkoutSummary(workout);

		const baseName = `${date} ${sanitizeFileName(tpl.name)}`;
		const path = uniquePath(this.app, paths.active, baseName);
		const file = await this.app.vault.create(path, serializeWorkout(workout));
		return { file, workout };
	}

	/** Autosave during a live workout. */
	async save(file: TFile, workout: Workout): Promise<void> {
		recomputeWorkoutSummary(workout);
		await writeFile(this.app, file, serializeWorkout(workout));
	}

	async finish(file: TFile, workout: Workout): Promise<TFile> {
		workout.status = 'completed';
		workout.completed = nowISODateTime();
		workout.current_phase_started = null;
		const start = parseISODateTime(workout.started);
		const end = parseISODateTime(workout.completed);
		workout.duration_minutes =
			start !== null && end !== null ? Math.max(0, Math.round((end - start) / 60000)) : null;
		recomputeWorkoutSummary(workout);
		return this.moveTo(file, workout, this.paths().completed);
	}

	async abandon(file: TFile, workout: Workout): Promise<TFile> {
		workout.status = 'abandoned';
		workout.current_phase_started = null;
		recomputeWorkoutSummary(workout);
		return this.moveTo(file, workout, this.paths().abandoned);
	}

	private async moveTo(file: TFile, workout: Workout, folder: string): Promise<TFile> {
		await ensureFolders(this.app, this.paths());
		await writeFile(this.app, file, serializeWorkout(workout));
		const target = uniquePath(this.app, folder, file.basename);
		await this.app.fileManager.renameFile(file, target);
		return getFile(this.app, normalizePath(target)) ?? file;
	}
}

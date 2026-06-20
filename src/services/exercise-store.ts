import { type App, TFile } from 'obsidian';
import type { Exercise } from '../types';
import { TYPE_EXERCISE } from '../utils/constants';
import { exerciseId } from '../utils/id';
import { todayISODate } from '../utils/date';
import { resolvePaths, ensureFolders, uniquePath, sanitizeFileName } from './paths';
import { exerciseFromFrontmatter } from './parse';
import { serializeExercise } from './serializer';
import { filesIn, readTyped, writeFile } from './vault-io';
import type { GymMDSettings } from '../settings';

export interface ExerciseEntry {
	file: TFile;
	exercise: Exercise;
}

export class ExerciseStore {
	constructor(
		private app: App,
		private getSettings: () => GymMDSettings,
	) {}

	private folder(): string {
		return resolvePaths(this.getSettings()).exercises;
	}

	async list(includeArchived = false): Promise<ExerciseEntry[]> {
		const entries: ExerciseEntry[] = [];
		for (const file of filesIn(this.app, this.folder())) {
			const exercise = await readTyped(this.app, file, exerciseFromFrontmatter);
			if (!exercise) continue;
			if (!includeArchived && exercise.archived) continue;
			entries.push({ file, exercise });
		}
		return entries.sort((a, b) => a.exercise.name.localeCompare(b.exercise.name));
	}

	async create(name: string): Promise<Exercise> {
		const paths = resolvePaths(this.getSettings());
		await ensureFolders(this.app, paths);
		const exercise: Exercise = {
			exercise_id: exerciseId(),
			type: TYPE_EXERCISE,
			name: name.trim(),
			archived: false,
			created: todayISODate(),
			notes: '',
		};
		const path = uniquePath(this.app, paths.exercises, exercise.name);
		await this.app.vault.create(path, serializeExercise(exercise));
		return exercise;
	}

	async save(file: TFile, exercise: Exercise): Promise<void> {
		await writeFile(this.app, file, serializeExercise(exercise));
	}

	async rename(file: TFile, exercise: Exercise, newName: string): Promise<void> {
		exercise.name = newName.trim();
		await this.save(file, exercise);
		const safe = sanitizeFileName(exercise.name);
		if (file.basename !== safe) {
			const target = uniquePath(this.app, this.folder(), exercise.name);
			await this.app.fileManager.renameFile(file, target);
		}
	}

	async setArchived(file: TFile, exercise: Exercise, archived: boolean): Promise<void> {
		exercise.archived = archived;
		await this.save(file, exercise);
	}
}

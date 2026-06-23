import {
	TYPE_EXERCISE,
	TYPE_TEMPLATE,
	TYPE_WORKOUT,
} from '../utils/constants';
import { entryUid } from '../utils/id';
import type {
	Exercise,
	Template,
	TemplateExercise,
	TemplateSet,
	Workout,
	WorkoutExercise,
	WorkoutSet,
	WorkoutStatus,
} from '../types';
import { readBody } from './serializer';

type Rec = Record<string, unknown>;

function asString(v: unknown, fallback = ''): string {
	if (v === null || v === undefined) return fallback;
	if (v instanceof Date) return isoDate(v);
	if (typeof v === 'object') return fallback;
	// eslint-disable-next-line @typescript-eslint/no-base-to-string
	return String(v);
}

function asNumberOrNull(v: unknown): number | null {
	if (v === null || v === undefined || v === '') return null;
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : null;
}

function asNumber(v: unknown, fallback = 0): number {
	return asNumberOrNull(v) ?? fallback;
}

function asBool(v: unknown, fallback = false): boolean {
	if (typeof v === 'boolean') return v;
	if (v === 'true') return true;
	if (v === 'false') return false;
	return fallback;
}

/** YAML may parse a bare date into a Date; normalize back to YYYY-MM-DD (UTC). */
function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function asDateString(v: unknown, fallback = ''): string {
	if (v instanceof Date) return isoDate(v);
	if (typeof v === 'string') return v.slice(0, 10);
	return fallback;
}

function asArray(v: unknown): Rec[] {
	return Array.isArray(v) ? (v as Rec[]) : [];
}

export function isType(fm: Rec | null, type: string): boolean {
	return !!fm && fm.type === type;
}

// --- Exercise -------------------------------------------------------------

export function exerciseFromFrontmatter(fm: Rec, content: string): Exercise | null {
	if (!isType(fm, TYPE_EXERCISE)) return null;
	return {
		exercise_id: asString(fm.exercise_id),
		type: TYPE_EXERCISE,
		name: asString(fm.name),
		archived: asBool(fm.archived),
		created: asDateString(fm.created),
		notes: readBody(content),
	};
}

// --- Template -------------------------------------------------------------

function templateSet(s: Rec): TemplateSet {
	return {
		set: asNumber(s.set),
		reps: asNumber(s.reps),
		weight: asNumber(s.weight),
	};
}

function templateExercise(e: Rec, index: number): TemplateExercise {
	return {
		uid: asString(e.uid) || entryUid(),
		exercise_id: asString(e.exercise_id),
		name: asString(e.name),
		order: asNumber(e.order, index + 1),
		sets: asArray(e.sets).map(templateSet),
	};
}

export function templateFromFrontmatter(fm: Rec): Template | null {
	if (!isType(fm, TYPE_TEMPLATE)) return null;
	const exercises = asArray(fm.exercises).map(templateExercise);
	return {
		type: TYPE_TEMPLATE,
		template_id: asString(fm.template_id),
		name: asString(fm.name),
		created: asDateString(fm.created),
		updated: asDateString(fm.updated),
		exercise_count: asNumber(fm.exercise_count, exercises.length),
		total_planned_sets: asNumber(
			fm.total_planned_sets,
			exercises.reduce((n, e) => n + e.sets.length, 0),
		),
		exercises,
	};
}

// --- Workout --------------------------------------------------------------

function workoutSet(s: Rec): WorkoutSet {
	return {
		set: asNumber(s.set),
		planned_reps: asNumberOrNull(s.planned_reps),
		planned_weight: asNumberOrNull(s.planned_weight),
		reps: asNumberOrNull(s.reps),
		weight: asNumberOrNull(s.weight),
		done: asBool(s.done),
		started: s.started ? asString(s.started) : null,
		duration_seconds: asNumberOrNull(s.duration_seconds),
	};
}

function workoutExercise(e: Rec, index: number): WorkoutExercise {
	return {
		uid: asString(e.uid) || entryUid(),
		exercise_id: asString(e.exercise_id),
		name: asString(e.name),
		order: asNumber(e.order, index + 1),
		sets: asArray(e.sets).map(workoutSet),
	};
}

export function workoutFromFrontmatter(fm: Rec): Workout | null {
	if (!isType(fm, TYPE_WORKOUT)) return null;
	const exercises = asArray(fm.exercises).map(workoutExercise);
	const status = asString(fm.status, 'in_progress') as WorkoutStatus;
	return {
		type: TYPE_WORKOUT,
		workout_id: asString(fm.workout_id),
		template_id: asString(fm.template_id),
		template_name: asString(fm.template_name),
		status,
		date: asDateString(fm.date),
		started: fm.started ? asString(fm.started) : null,
		completed: fm.completed ? asString(fm.completed) : null,
		duration_minutes: asNumberOrNull(fm.duration_minutes),
		current_phase_started: fm.current_phase_started ? asString(fm.current_phase_started) : null,
		exercise_count: asNumber(fm.exercise_count, exercises.length),
		total_sets_planned: asNumber(fm.total_sets_planned),
		total_sets_completed: asNumber(fm.total_sets_completed),
		total_volume_kg: asNumber(fm.total_volume_kg),
		exercises,
	};
}

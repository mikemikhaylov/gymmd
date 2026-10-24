import {
	TYPE_EXERCISE,
	TYPE_JOURNAL,
	TYPE_JOURNAL_ITEMS,
	TYPE_TEMPLATE,
	TYPE_WORKOUT,
} from '../utils/constants';
import { entryUid } from '../utils/id';
import type {
	Exercise,
	JournalAnswer,
	JournalDay,
	JournalField,
	JournalItem,
	Template,
	TemplateExercise,
	TemplateSet,
	Workout,
	WorkoutExercise,
	WorkoutSet,
	WorkoutStatus,
} from '../types';
import { readBody } from './serializer';
import { DOSAGE_UNITS, FIELD_ORDER, INTENSITY_MAX, sortFields } from './journal';

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
		exercises,
	};
}

// --- Workout --------------------------------------------------------------

function workoutSet(s: Rec): WorkoutSet {
	return {
		set: asNumber(s.set),
		// Fall back to legacy planned_* for any pre-existing files.
		reps: asNumberOrNull(s.reps ?? s.planned_reps),
		weight: asNumberOrNull(s.weight ?? s.planned_weight),
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
		status,
		started: fm.started ? asString(fm.started) : null,
		completed: fm.completed ? asString(fm.completed) : null,
		current_phase_started: fm.current_phase_started ? asString(fm.current_phase_started) : null,
		exercises,
	};
}

// --- Journal --------------------------------------------------------------

/** Datetime string or null. YAML parses an unquoted timestamp as a UTC Date. */
function asDateTimeOrNull(v: unknown): string | null {
	if (v instanceof Date) return v.toISOString().slice(0, 19);
	if (typeof v === 'string' && v.trim()) return v.trim();
	return null;
}

function asStringOrNull(v: unknown): string | null {
	const s = asString(v).trim();
	return s ? s : null;
}

function journalFields(v: unknown): JournalField[] {
	const raw = Array.isArray(v) ? v.map((f) => asString(f)) : [];
	return sortFields(raw.filter((f): f is JournalField => (FIELD_ORDER as string[]).includes(f)));
}

function journalItem(it: Rec, index: number): JournalItem {
	return {
		item_id: asString(it.item_id),
		name: asString(it.name),
		hint: asString(it.hint),
		builtin: asBool(it.builtin),
		enabled: asBool(it.enabled, true),
		repeatable: asBool(it.repeatable),
		order: asNumber(it.order, index + 1),
		fields: journalFields(it.fields),
		count_unit: asString(it.count_unit),
		// Only written when the item has a dosage field; default for when it's enabled later.
		dosage_unit: asString(it.dosage_unit) || DOSAGE_UNITS[0],
	};
}

export function journalItemsFromFrontmatter(fm: Rec): JournalItem[] | null {
	if (!isType(fm, TYPE_JOURNAL_ITEMS)) return null;
	return asArray(fm.items)
		.map(journalItem)
		.filter((it) => it.item_id)
		.sort((a, b) => a.order - b.order);
}

function journalAnswer(a: Rec): JournalAnswer {
	const intensity = asNumberOrNull(a.intensity);
	return {
		item_id: asString(a.item_id),
		name: asString(a.name),
		answer: asBool(a.answer, true),
		time: asDateTimeOrNull(a.time),
		start: asDateTimeOrNull(a.start),
		end: asDateTimeOrNull(a.end),
		duration_min: asNumberOrNull(a.duration_min),
		count: asNumberOrNull(a.count),
		count_unit: asStringOrNull(a.count_unit),
		dosage: asNumberOrNull(a.dosage),
		dosage_unit: asStringOrNull(a.dosage_unit),
		intensity: intensity === null ? null : Math.min(INTENSITY_MAX, Math.max(1, Math.round(intensity))),
		note: asString(a.note),
	};
}

export function journalDayFromFrontmatter(fm: Rec): JournalDay | null {
	if (!isType(fm, TYPE_JOURNAL)) return null;
	return {
		type: TYPE_JOURNAL,
		date: asDateString(fm.date),
		updated: asDateTimeOrNull(fm.updated),
		entries: asArray(fm.entries)
			.map(journalAnswer)
			.filter((a) => a.item_id),
	};
}

/**
 * Shared domain types for GymMD.
 *
 * Frontmatter is the single source of truth (see PLAN.md §11); these types
 * model exactly what lives in each file's YAML frontmatter. The markdown body
 * is generated output and is never parsed back into these types.
 */

/** ISO-8601 datetime, stored as a quoted string, e.g. "2026-06-20T18:02:11". */
export type ISODateTime = string;

/** Plain calendar date, e.g. "2026-06-20". */
export type ISODate = string;

// --- Exercise -------------------------------------------------------------

export interface Exercise {
	exercise_id: string;
	type: 'workout-exercise';
	name: string;
	archived: boolean;
	created: ISODate;
	/** Free-text body content (form cues, equipment, etc). */
	notes: string;
}

// --- Template -------------------------------------------------------------

export interface TemplateSet {
	set: number;
	reps: number;
	/** 0 means bodyweight; displayed as "BW". */
	weight: number;
}

export interface TemplateExercise {
	exercise_id: string;
	name: string;
	order: number;
	sets: TemplateSet[];
}

export interface Template {
	type: 'workout-template';
	template_id: string;
	name: string;
	created: ISODate;
	updated: ISODate;
	exercise_count: number;
	total_planned_sets: number;
	exercises: TemplateExercise[];
}

// --- Workout --------------------------------------------------------------

export type WorkoutStatus = 'in_progress' | 'completed' | 'abandoned';

export interface WorkoutSet {
	set: number;
	planned_reps: number | null;
	planned_weight: number | null;
	reps: number | null;
	weight: number | null;
	done: boolean;
	started: ISODateTime | null;
	duration_seconds: number | null;
}

export interface WorkoutExercise {
	exercise_id: string;
	name: string;
	order: number;
	sets: WorkoutSet[];
}

export interface Workout {
	type: 'workout';
	workout_id: string;
	template_id: string;
	template_name: string;
	status: WorkoutStatus;
	date: ISODate;
	started: ISODateTime | null;
	completed: ISODateTime | null;
	duration_minutes: number | null;
	/** Stopwatch anchor; null until the first Start Set press, cleared on finish. */
	current_phase_started: ISODateTime | null;
	exercise_count: number;
	total_sets_planned: number;
	total_sets_completed: number;
	total_volume_kg: number;
	exercises: WorkoutExercise[];
}

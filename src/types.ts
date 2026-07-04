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
	/** Stable per-entry id (an exercise may appear more than once). */
	uid: string;
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
	exercises: TemplateExercise[];
}

// --- Workout --------------------------------------------------------------

export type WorkoutStatus = 'in_progress' | 'completed';

export interface WorkoutSet {
	set: number;
	/** Copied from the template at creation; visible and editable at any time. */
	reps: number | null;
	weight: number | null;
	done: boolean;
	started: ISODateTime | null;
	duration_seconds: number | null;
}

export interface WorkoutExercise {
	/** Stable per-entry id, copied from the template entry it came from. */
	uid: string;
	exercise_id: string;
	name: string;
	order: number;
	sets: WorkoutSet[];
}

// --- Body weight ----------------------------------------------------------

export interface BodyWeightMeasurement {
	id: string;
	/** Weight in kg. */
	weight: number;
	/** ISO-8601 datetime, e.g. "2026-07-04T08:30:00". */
	at: ISODateTime;
}

// --- Workout --------------------------------------------------------------

export interface Workout {
	type: 'workout';
	workout_id: string;
	template_id: string;
	status: WorkoutStatus;
	started: ISODateTime | null;
	completed: ISODateTime | null;
	/** Stopwatch anchor; null until the first Start Set press, cleared on finish. */
	current_phase_started: ISODateTime | null;
	exercises: WorkoutExercise[];
}

import type { Template, Workout } from '../types';
import { todayISODate } from '../utils/date';
import { recomputeTemplateSummary } from './summary';

/**
 * Diff a finished workout against the template it came from, considering only
 * COMPLETED sets (PLAN.md §7). Skipped/incomplete sets never appear as a
 * difference — a cut-short workout must not suggest removing sets from the
 * template. The diff captures progression (heavier weight, more reps),
 * ad-hoc completed sets, and exercise reordering.
 */

export interface TemplateDiff {
	changes: string[];
	hasChanges: boolean;
}

function wt(weight: number | null): string {
	if (weight === null) return '?';
	return weight === 0 ? 'BW' : `${weight}kg`;
}

function reps(r: number | null): string {
	return r === null ? '?' : String(r);
}

function sameMembers(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	const sa = [...a].sort();
	const sb = [...b].sort();
	return sa.every((v, i) => v === sb[i]);
}

export function diffCompletedAgainstTemplate(w: Workout, tpl: Template): TemplateDiff {
	const changes: string[] = [];

	const workoutIds = w.exercises.map((e) => e.exercise_id);
	const templateIds = tpl.exercises.map((e) => e.exercise_id);
	if (sameMembers(workoutIds, templateIds) && workoutIds.join('|') !== templateIds.join('|')) {
		changes.push('Exercise order changed');
	}

	for (const wex of w.exercises) {
		const tex = tpl.exercises.find((e) => e.exercise_id === wex.exercise_id);
		const completed = wex.sets.filter((s) => s.done);
		if (completed.length === 0) continue;

		if (!tex) {
			changes.push(`${wex.name}: new exercise (${completed.length} completed set(s))`);
			continue;
		}

		completed.forEach((s, i) => {
			const t = tex.sets[i];
			if (!t) {
				changes.push(`${wex.name} set ${i + 1}: added — ${reps(s.reps)}×${wt(s.weight)}`);
				return;
			}
			if ((s.reps ?? 0) !== t.reps || (s.weight ?? 0) !== t.weight) {
				changes.push(
					`${wex.name} set ${i + 1}: ${reps(t.reps)}×${wt(t.weight)} → ${reps(s.reps)}×${wt(s.weight)}`,
				);
			}
		});
	}

	return { changes, hasChanges: changes.length > 0 };
}

/**
 * Produce a new Template reflecting the completed sets of the workout.
 * Completed sets overwrite the matching template set's reps/weight; skipped
 * sets are left intact (not removed); ad-hoc completed sets are appended;
 * exercises are reordered to match the workout. Exercises only in the template
 * (never touched) are preserved at the end.
 */
export function applyCompletedToTemplate(w: Workout, tpl: Template): Template {
	const next: Template = structuredClone(tpl);
	const byId = new Map(next.exercises.map((e) => [e.exercise_id, e]));
	const ordered: typeof next.exercises = [];

	for (const wex of w.exercises) {
		const completed = wex.sets.filter((s) => s.done);
		let tex = byId.get(wex.exercise_id);

		if (!tex) {
			if (completed.length === 0) continue;
			tex = {
				exercise_id: wex.exercise_id,
				name: wex.name,
				order: 0,
				sets: [],
			};
			byId.set(wex.exercise_id, tex);
		}

		completed.forEach((s, i) => {
			const target = tex.sets[i];
			if (target) {
				target.reps = s.reps ?? target.reps;
				target.weight = s.weight ?? target.weight;
			} else {
				tex.sets.push({ set: tex.sets.length + 1, reps: s.reps ?? 0, weight: s.weight ?? 0 });
			}
		});

		ordered.push(tex);
	}

	// Keep template-only exercises (present in template, absent from workout).
	for (const tex of next.exercises) {
		if (!ordered.includes(tex)) ordered.push(tex);
	}

	next.exercises = ordered;
	next.updated = todayISODate();
	recomputeTemplateSummary(next);
	return next;
}

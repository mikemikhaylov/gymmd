import type { Template, Workout } from '../types';

/** Recompute derived frontmatter fields + normalize order/set numbering. */
export function recomputeTemplateSummary(tpl: Template): void {
	tpl.exercises.forEach((ex, i) => {
		ex.order = i + 1;
		ex.sets.forEach((s, j) => {
			s.set = j + 1;
		});
	});
	tpl.exercise_count = tpl.exercises.length;
	tpl.total_planned_sets = tpl.exercises.reduce((n, ex) => n + ex.sets.length, 0);
}

/** Recompute workout totals + normalize order/set numbering. Volume counts only completed sets. */
export function recomputeWorkoutSummary(w: Workout): void {
	let volume = 0;
	let completed = 0;
	let planned = 0;

	w.exercises.forEach((ex, i) => {
		ex.order = i + 1;
		ex.sets.forEach((s, j) => {
			s.set = j + 1;
			planned += 1;
			if (s.done) {
				completed += 1;
				volume += (s.reps ?? 0) * (s.weight ?? 0);
			}
		});
	});

	w.exercise_count = w.exercises.length;
	w.total_sets_planned = planned;
	w.total_sets_completed = completed;
	w.total_volume_kg = Math.round(volume * 100) / 100;
}

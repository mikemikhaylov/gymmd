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

/** Normalize a workout's exercise `order` and per-exercise `set` numbering. */
export function renumberWorkout(w: Workout): void {
	w.exercises.forEach((ex, i) => {
		ex.order = i + 1;
		ex.sets.forEach((s, j) => {
			s.set = j + 1;
		});
	});
}

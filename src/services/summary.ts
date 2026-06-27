import type { Template, Workout } from '../types';

/** Normalize a template's exercise `order` and per-exercise `set` numbering. */
export function renumberTemplate(tpl: Template): void {
	tpl.exercises.forEach((ex, i) => {
		ex.order = i + 1;
		ex.sets.forEach((s, j) => {
			s.set = j + 1;
		});
	});
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

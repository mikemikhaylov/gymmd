/**
 * Stable short ID generation. IDs are the join key across Exercises, Templates,
 * and Workouts and never change once assigned (see PLAN.md §11).
 */

function randomSuffix(length: number): string {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let out = '';
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	for (let i = 0; i < length; i++) {
		out += alphabet[bytes[i] % alphabet.length];
	}
	return out;
}

export function exerciseId(): string {
	return `ex-${randomSuffix(6)}`;
}

export function templateId(): string {
	return `tpl-${randomSuffix(6)}`;
}

export function workoutId(): string {
	return `wkt-${randomSuffix(6)}`;
}

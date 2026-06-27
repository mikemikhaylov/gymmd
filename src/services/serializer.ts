import { parseYaml } from 'obsidian';
import type { Exercise, Template, Workout } from '../types';
import { timeOfDay } from '../utils/date';

/**
 * Serialization is one-directional: data -> file. The markdown body is
 * generated, write-only output (PLAN.md §11). Reading only ever touches the
 * YAML frontmatter, never the tables.
 */

// --- YAML scalar emission -------------------------------------------------

/** Quote a string only when bare YAML would misparse it. */
function yamlString(s: string): string {
	const simple =
		/^[A-Za-z0-9_][A-Za-z0-9 _/().+-]*$/.test(s) &&
		!/^(true|false|null|yes|no|on|off|~)$/i.test(s);
	return simple ? s : JSON.stringify(s);
}

/** Emit a scalar; null/undefined become an empty value (`key:`). */
function scalar(v: string | number | boolean | null | undefined): string {
	if (v === null || v === undefined) return '';
	if (typeof v === 'boolean') return v ? 'true' : 'false';
	if (typeof v === 'number') return String(v);
	return yamlString(v);
}

function line(indent: number, key: string, v: string | number | boolean | null | undefined): string {
	const value = scalar(v);
	const pad = '  '.repeat(indent);
	return value === '' ? `${pad}${key}:` : `${pad}${key}: ${value}`;
}

function wrapFrontmatter(body: string, frontmatter: string[]): string {
	return `---\n${frontmatter.join('\n')}\n---\n\n${body}`;
}

// --- Body cell helpers ----------------------------------------------------

function weightCell(w: number | null): string {
	if (w === null || w === undefined) return '';
	return w === 0 ? 'BW' : String(w);
}

function numCell(n: number | null): string {
	return n === null || n === undefined ? '' : String(n);
}

// --- Exercise -------------------------------------------------------------

export function serializeExercise(ex: Exercise): string {
	const fm = [
		line(0, 'exercise_id', ex.exercise_id),
		line(0, 'type', ex.type),
		line(0, 'name', ex.name),
		line(0, 'archived', ex.archived),
		line(0, 'created', ex.created),
	];
	return wrapFrontmatter(ex.notes ?? '', fm);
}

// --- Template -------------------------------------------------------------

export function serializeTemplate(tpl: Template): string {
	const fm = [
		line(0, 'type', tpl.type),
		line(0, 'template_id', tpl.template_id),
		line(0, 'name', tpl.name),
		line(0, 'created', tpl.created),
		line(0, 'updated', tpl.updated),
		'exercises:',
	];
	for (const ex of tpl.exercises) {
		fm.push(`  - ${line(0, 'uid', ex.uid).trimStart()}`);
		fm.push(line(2, 'exercise_id', ex.exercise_id));
		fm.push(line(2, 'name', ex.name));
		fm.push(line(2, 'order', ex.order));
		fm.push('    sets:');
		for (const s of ex.sets) {
			fm.push(`      - ${line(0, 'set', s.set).trimStart()}`);
			fm.push(line(4, 'reps', s.reps));
			fm.push(line(4, 'weight', s.weight));
		}
	}

	const bodyParts: string[] = [`# ${tpl.name}`, ''];
	for (const ex of tpl.exercises) {
		bodyParts.push(`## ${ex.name}`);
		bodyParts.push('| Set | Reps | Weight (kg) |');
		bodyParts.push('|---|---|---|');
		for (const s of ex.sets) {
			bodyParts.push(`| ${s.set} | ${numCell(s.reps)} | ${weightCell(s.weight)} |`);
		}
		bodyParts.push('');
	}

	return wrapFrontmatter(bodyParts.join('\n').trimEnd() + '\n', fm);
}

// --- Workout --------------------------------------------------------------

export function serializeWorkout(w: Workout, title: string): string {
	const fm = [
		line(0, 'type', w.type),
		line(0, 'workout_id', w.workout_id),
		line(0, 'template_id', w.template_id),
		line(0, 'status', w.status),
		line(0, 'started', w.started),
		line(0, 'completed', w.completed),
	];
	// Stopwatch anchor — only meaningful while in progress; omit once cleared.
	if (w.current_phase_started !== null) {
		fm.push(line(0, 'current_phase_started', w.current_phase_started));
	}
	fm.push('exercises:');
	for (const ex of w.exercises) {
		fm.push(`  - ${line(0, 'uid', ex.uid).trimStart()}`);
		fm.push(line(2, 'exercise_id', ex.exercise_id));
		fm.push(line(2, 'name', ex.name));
		fm.push(line(2, 'order', ex.order));
		fm.push('    sets:');
		for (const s of ex.sets) {
			fm.push(`      - ${line(0, 'set', s.set).trimStart()}`);
			fm.push(line(4, 'reps', s.reps));
			fm.push(line(4, 'weight', s.weight));
			fm.push(line(4, 'done', s.done));
			fm.push(line(4, 'started', s.started));
			fm.push(line(4, 'duration_seconds', s.duration_seconds));
		}
	}

	const bodyParts: string[] = [`# ${title}`, ''];
	for (const ex of w.exercises) {
		bodyParts.push(`## ${ex.name}`);
		bodyParts.push('| Set | Reps | Weight (kg) | Done | Started | Duration (s) |');
		bodyParts.push('|---|---|---|---|---|---|');
		for (const s of ex.sets) {
			const done = s.done ? '✅' : '⬜';
			bodyParts.push(
				`| ${s.set} | ${numCell(s.reps)} | ${weightCell(s.weight)} | ${done} | ${timeOfDay(s.started)} | ${numCell(s.duration_seconds)} |`,
			);
		}
		bodyParts.push('');
	}

	return wrapFrontmatter(bodyParts.join('\n').trimEnd() + '\n', fm);
}

// --- Reading (frontmatter only) -------------------------------------------

/** Parse the YAML frontmatter block from raw file content, or null if absent. */
export function readFrontmatter(content: string): Record<string, unknown> | null {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return null;
	const parsed: unknown = parseYaml(match[1]);
	return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
}

/** Extract the markdown body (everything after the frontmatter block). */
export function readBody(content: string): string {
	const match = content.match(/^---\n[\s\S]*?\n---\n?/);
	return match ? content.slice(match[0].length).replace(/^\n+/, '') : content;
}

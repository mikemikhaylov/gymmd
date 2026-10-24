import { parseYaml } from 'obsidian';
import type { Exercise, JournalDay, JournalItem, Template, Workout } from '../types';
import { TYPE_JOURNAL, TYPE_JOURNAL_ITEMS } from '../utils/constants';
import { timeOfDay } from '../utils/date';
import { describeAnswer, FIELD_LABELS, INTENSITY_MAX } from './journal';

/**
 * Serialization is one-directional: data -> file. The markdown body is
 * generated, write-only output (PLAN.md §11). Reading only ever touches the
 * YAML frontmatter, never the tables.
 */

/** Recording conventions, added as a short note to every workout body. */
export const WORKOUT_NOTE =
	'> Weights are the total load lifted — for dumbbells, the combined weight of both. ' +
	'Reps are total reps — for alternating/both-side exercises (e.g. lunges), both sides combined.';

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

	const bodyParts: string[] = [`# ${title}`, '', WORKOUT_NOTE, ''];
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

// --- Journal --------------------------------------------------------------

/** Schema notes written into journal bodies so a human or AI reader can interpret the YAML. */
export const JOURNAL_NOTE =
	'> Generated from the frontmatter (the source of truth — edit the YAML, not this table). ' +
	'`answer: true/false` = yes/no; unanswered items are omitted; a repeatable item has one entry per occurrence. Times are local ISO datetimes ' +
	`(an end before the start rolls to the next day); \`duration_min\` is minutes; \`intensity\` is 1–${INTENSITY_MAX}. ` +
	'Each answer carries its item name and units; `item_id` joins it to `journal/items.md`.';

function tableCell(s: string): string {
	return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function serializeJournalItems(items: JournalItem[]): string {
	const fm = [line(0, 'type', TYPE_JOURNAL_ITEMS), 'items:'];
	for (const it of items) {
		fm.push(`  - ${line(0, 'item_id', it.item_id).trimStart()}`);
		fm.push(line(2, 'name', it.name));
		if (it.hint) fm.push(line(2, 'hint', it.hint));
		fm.push(line(2, 'builtin', it.builtin));
		fm.push(line(2, 'enabled', it.enabled));
		fm.push(line(2, 'repeatable', it.repeatable));
		fm.push(line(2, 'order', it.order));
		fm.push(`    fields: [${it.fields.join(', ')}]`);
		if (it.fields.includes('count')) fm.push(line(2, 'count_unit', it.count_unit));
		if (it.fields.includes('dosage')) fm.push(line(2, 'dosage_unit', it.dosage_unit));
	}

	const body = [
		'# Journal items',
		'',
		'> Definitions of the daily journal questions. Disabled items are hidden from the journal; their past answers are kept. Repeatable items may have several answers per day. ' +
			'Fields: `time`, `start`, `end`, `duration` (minutes), `count` (portions in `count_unit`), ' +
			`\`dosage\` (in \`dosage_unit\`), \`intensity\` (1–${INTENSITY_MAX}), \`note\`.`,
		'',
		'| Item | Enabled | Repeatable | Asks for | Units |',
		'|---|---|---|---|---|',
	];
	for (const it of items) {
		const asks = it.fields.length ? it.fields.map((f) => FIELD_LABELS[f]).join(', ') : 'yes / no';
		const units = [
			it.fields.includes('count') ? it.count_unit : '',
			it.fields.includes('dosage') ? it.dosage_unit : '',
		]
			.filter(Boolean)
			.join(', ');
		body.push(
			`| ${tableCell(it.name)} | ${it.enabled ? '✅' : '⬜'} | ${it.repeatable ? '✅' : '⬜'} | ${asks} | ${tableCell(units)} |`,
		);
	}
	return wrapFrontmatter(body.join('\n') + '\n', fm);
}

export function serializeJournalDay(day: JournalDay): string {
	const fm = [
		line(0, 'type', TYPE_JOURNAL),
		// Quoted so YAML keeps it a string rather than parsing a Date.
		`date: ${JSON.stringify(day.date)}`,
		line(0, 'updated', day.updated),
		'entries:',
	];
	for (const a of day.entries) {
		fm.push(`  - ${line(0, 'item_id', a.item_id).trimStart()}`);
		fm.push(line(2, 'name', a.name));
		fm.push(line(2, 'answer', a.answer));
		// Only emit what was recorded, so files stay small and every key is meaningful.
		if (a.time) fm.push(line(2, 'time', a.time));
		if (a.start) fm.push(line(2, 'start', a.start));
		if (a.end) fm.push(line(2, 'end', a.end));
		if (a.duration_min !== null) fm.push(line(2, 'duration_min', a.duration_min));
		if (a.count !== null) {
			fm.push(line(2, 'count', a.count));
			if (a.count_unit) fm.push(line(2, 'count_unit', a.count_unit));
		}
		if (a.dosage !== null) {
			fm.push(line(2, 'dosage', a.dosage));
			if (a.dosage_unit) fm.push(line(2, 'dosage_unit', a.dosage_unit));
		}
		if (a.intensity !== null) fm.push(line(2, 'intensity', a.intensity));
		if (a.note) fm.push(line(2, 'note', a.note));
	}

	const body = [`# Journal ${day.date}`, '', JOURNAL_NOTE, ''];
	if (day.entries.length) {
		body.push('| Item | Answer | Details |', '|---|---|---|');
		for (const a of day.entries) {
			body.push(
				`| ${tableCell(a.name)} | ${a.answer ? 'Yes' : 'No'} | ${tableCell(describeAnswer(a, day.date))} |`,
			);
		}
	}
	return wrapFrontmatter(body.join('\n').trimEnd() + '\n', fm);
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

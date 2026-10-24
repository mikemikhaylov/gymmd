import type { ISODate, ISODateTime, JournalAnswer, JournalField, JournalItem } from '../types';
import { addDays, daysBetween, parseISODateTime } from '../utils/date';

/**
 * Pure journal logic: built-in items, presets for custom items, field metadata,
 * and the time arithmetic used by the journal screen. No vault I/O here.
 */

/** Canonical field order (also the order inputs appear in a card). */
export const FIELD_ORDER: JournalField[] = [
	'time',
	'start',
	'end',
	'duration',
	'count',
	'dosage',
	'intensity',
	'note',
];

export const FIELD_LABELS: Record<JournalField, string> = {
	time: 'Time',
	start: 'Started',
	end: 'Stopped',
	duration: 'Duration (min)',
	count: 'Portions',
	dosage: 'Dosage',
	intensity: 'Intensity (1–10)',
	note: 'Note',
};

export const DOSAGE_UNITS = ['mg', 'mcg', 'g', 'ml', 'IU', 'drops', 'capsules', 'tablets', 'scoops'];

export const INTENSITY_MAX = 10;

export function sortFields(fields: JournalField[]): JournalField[] {
	return FIELD_ORDER.filter((f) => fields.includes(f));
}

/** Items seeded into a fresh `items.md`. */
export function builtinItems(): JournalItem[] {
	return [
		{
			item_id: 'caffeine',
			name: 'Caffeine',
			hint: 'Time of your last cup and how many cups in total.',
			builtin: true,
			enabled: true,
			repeatable: false,
			order: 1,
			fields: ['time', 'count'],
			count_unit: 'cups',
			dosage_unit: 'mg',
		},
		{
			item_id: 'cold_shower',
			name: 'Cold shower',
			hint: 'When you took it and for how many minutes.',
			builtin: true,
			enabled: true,
			repeatable: false,
			order: 2,
			fields: ['time', 'duration'],
			count_unit: '',
			dosage_unit: 'mg',
		},
		{
			item_id: 'sauna',
			name: 'Sauna',
			hint: 'When you got out and total minutes inside.',
			builtin: true,
			enabled: true,
			repeatable: false,
			order: 3,
			fields: ['end', 'duration'],
			count_unit: '',
			dosage_unit: 'mg',
		},
		{
			item_id: 'mobility',
			name: 'Mobility / stretching',
			hint: 'When and how long; note what you worked on (hips, shoulders…).',
			builtin: true,
			enabled: true,
			repeatable: true,
			order: 4,
			fields: ['time', 'duration', 'note'],
			count_unit: '',
			dosage_unit: 'mg',
		},
		{
			item_id: 'late_meal',
			name: 'Late meal',
			hint: 'Time of your last meal before bed.',
			builtin: true,
			enabled: true,
			repeatable: false,
			order: 5,
			fields: ['time'],
			count_unit: '',
			dosage_unit: 'mg',
		},
		{
			item_id: 'sick',
			name: 'Sick / illness',
			hint: 'How bad it felt overall; note the symptoms.',
			builtin: true,
			enabled: true,
			repeatable: false,
			order: 6,
			fields: ['intensity', 'note'],
			count_unit: '',
			dosage_unit: 'mg',
		},
		{
			item_id: 'meditation',
			name: 'Meditation / breathwork',
			hint: 'When and for how many minutes.',
			builtin: true,
			enabled: true,
			repeatable: true,
			order: 7,
			fields: ['time', 'duration'],
			count_unit: '',
			dosage_unit: 'mg',
		},
	];
}

export interface JournalPreset {
	id: string;
	label: string;
	fields: JournalField[];
	repeatable: boolean;
	count_unit?: string;
	dosage_unit?: string;
}

/** Starting points offered when creating a custom item. */
export const PRESETS: JournalPreset[] = [
	{ id: 'yesno', label: 'Yes / no', fields: [], repeatable: false },
	{ id: 'symptom', label: 'Symptom', fields: ['start', 'end', 'intensity', 'note'], repeatable: true },
	{
		id: 'supplement',
		label: 'Supplement / medication',
		fields: ['time', 'dosage'],
		repeatable: true,
		dosage_unit: 'mg',
	},
	{ id: 'activity', label: 'Activity', fields: ['time', 'duration'], repeatable: true },
	{ id: 'intake', label: 'Food / drink', fields: ['time', 'count'], repeatable: false, count_unit: 'servings' },
];

export function countLabel(unit: string | null | undefined): string {
	return unit ? `Portions (${unit})` : FIELD_LABELS.count;
}

export function emptyAnswer(item: JournalItem, answer: boolean): JournalAnswer {
	return {
		item_id: item.item_id,
		name: item.name,
		answer,
		time: null,
		start: null,
		end: null,
		duration_min: null,
		count: null,
		count_unit: item.fields.includes('count') ? item.count_unit || null : null,
		dosage: null,
		dosage_unit: item.fields.includes('dosage') ? item.dosage_unit || null : null,
		intensity: null,
		note: '',
	};
}

// --- Time helpers ---------------------------------------------------------

/** "2026-10-24T07:30:00" -> "07:30" (value for an <input type="time">). */
export function toTimeInput(iso: ISODateTime | null): string {
	return iso && iso.length >= 16 ? iso.slice(11, 16) : '';
}

/** Combine the journal date with an "HH:MM" input value. */
export function fromTimeInput(date: ISODate, hhmm: string): ISODateTime | null {
	return /^\d{2}:\d{2}$/.test(hhmm) ? `${date}T${hhmm}:00` : null;
}

/**
 * Resolve an end time picked as HH:MM: if it falls before the start time it is
 * taken to be the next morning (e.g. a headache from 22:00 to 03:00).
 */
export function resolveEnd(
	date: ISODate,
	hhmm: string,
	start: ISODateTime | null,
): ISODateTime | null {
	const end = fromTimeInput(date, hhmm);
	if (!end || !start) return end;
	const sameDay = fromTimeInput(start.slice(0, 10), hhmm);
	if (sameDay && sameDay >= start) return sameDay;
	return fromTimeInput(addDays(start.slice(0, 10), 1), hhmm);
}

/** Whole minutes between two datetimes, or null if either is missing/invalid. */
export function minutesBetween(start: ISODateTime | null, end: ISODateTime | null): number | null {
	const a = parseISODateTime(start);
	const b = parseISODateTime(end);
	if (a === null || b === null || b < a) return null;
	return Math.round((b - a) / 60_000);
}

/** Move a datetime from one journal day to another, keeping its day offset. */
export function shiftDateTime(
	iso: ISODateTime | null,
	from: ISODate,
	to: ISODate,
): ISODateTime | null {
	if (!iso || iso.length < 19) return iso;
	const offset = daysBetween(from, iso.slice(0, 10));
	return `${addDays(to, offset)}${iso.slice(10)}`;
}

/** Copy a previous day's answer onto `date`, re-anchoring its times. */
export function copyAnswer(
	prev: JournalAnswer,
	prevDate: ISODate,
	date: ISODate,
	item: JournalItem,
): JournalAnswer {
	return {
		...prev,
		name: item.name,
		time: shiftDateTime(prev.time, prevDate, date),
		start: shiftDateTime(prev.start, prevDate, date),
		end: shiftDateTime(prev.end, prevDate, date),
	};
}

// --- Display --------------------------------------------------------------

function trimNum(n: number): string {
	return String(Math.round(n * 100) / 100);
}

/** One-line human summary of an answer's details, e.g. "07:30 · 2 cups". */
export function describeAnswer(a: JournalAnswer, date: ISODate): string {
	if (!a.answer) return '';
	const parts: string[] = [];
	const t = (iso: ISODateTime | null) => {
		if (!iso) return '';
		const d = daysBetween(date, iso.slice(0, 10));
		return d === 0 ? toTimeInput(iso) : `${toTimeInput(iso)} (${d > 0 ? '+' : ''}${d}d)`;
	};
	if (a.time) parts.push(t(a.time));
	if (a.start && a.end) parts.push(`${t(a.start)}–${t(a.end)}`);
	else if (a.start) parts.push(`from ${t(a.start)}`);
	else if (a.end) parts.push(`until ${t(a.end)}`);
	if (a.duration_min !== null) parts.push(`${trimNum(a.duration_min)} min`);
	if (a.count !== null) parts.push(`${trimNum(a.count)}${a.count_unit ? ` ${a.count_unit}` : ''}`);
	if (a.dosage !== null) parts.push(`${trimNum(a.dosage)}${a.dosage_unit ? ` ${a.dosage_unit}` : ''}`);
	if (a.intensity !== null) parts.push(`intensity ${a.intensity}/${INTENSITY_MAX}`);
	if (a.note) parts.push(a.note.replace(/\s+/g, ' '));
	return parts.join(' · ');
}

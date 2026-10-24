/**
 * Boots the real GymMD plugin against the `obsidian` stub with a seeded
 * in-memory vault. URL params:
 *   route=<Route>        screen to open (default: home)
 *   theme=dark|light     (default: dark)
 *   seed=full|empty      sample data or a fresh vault (default: full)
 *   active=1             include an in-progress workout
 *   desktop=1            desktop layout instead of phone
 */
import { App } from 'obsidian';
import GymMDPlugin from '../../src/main';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { resolvePaths } from '../../src/services/paths';
import {
	serializeExercise,
	serializeJournalDay,
	serializeJournalItems,
	serializeTemplate,
	serializeWorkout,
} from '../../src/services/serializer';
import { serializeBodyWeight } from '../../src/services/body-weight-store';
import { builtinItems, emptyAnswer } from '../../src/services/journal';
import { addDays, nowISODateTime, todayISODate } from '../../src/utils/date';
import type { Exercise, JournalAnswer, JournalItem, Template, Workout } from '../../src/types';
import type { Route } from '../../src/ui/navigation';

const params = new URLSearchParams(location.search);
const theme = params.get('theme') === 'light' ? 'theme-light' : 'theme-dark';
document.body.addClass(theme, 'mod-macos');
if (params.get('desktop') !== '1') document.body.addClass('is-mobile', 'is-phone', 'is-ios');

// --- DOM shell (mirrors Obsidian mobile's workspace structure) ------------

const appContainer = document.body.createDiv('app-container');
const main = appContainer.createDiv('horizontal-main-container');
const workspace = main.createDiv('workspace');
const split = workspace.createDiv('workspace-split mod-vertical mod-root');
const tabs = split.createDiv('workspace-tabs mod-active mod-visible');
const tabContainer = tabs.createDiv('workspace-tab-container');
const leafEl = tabContainer.createDiv('workspace-leaf mod-active');
const leafContent = leafEl.createDiv('workspace-leaf-content');
const navbar = appContainer.createDiv('mobile-navbar');
const actions = navbar.createDiv('mobile-navbar-actions');
for (const label of ['‹', '›', '+', '☰', '⋯']) {
	actions.createDiv({ cls: 'mobile-navbar-action clickable-icon', text: label });
}

// --- Seed data ------------------------------------------------------------

const app = new App(leafContent);
const paths = resolvePaths(DEFAULT_SETTINGS);
const today = todayISODate();

async function write(path: string, content: string): Promise<void> {
	const dir = path.slice(0, path.lastIndexOf('/'));
	let cur = '';
	for (const part of dir.split('/')) {
		cur = cur ? `${cur}/${part}` : part;
		await app.vault.createFolder(cur);
	}
	await app.vault.create(path, content);
}

function exercise(id: string, name: string): Exercise {
	return { exercise_id: id, type: 'workout-exercise', name, archived: false, created: addDays(today, -60), notes: '' };
}

const EX = {
	bench: exercise('ex-bench1', 'Bench Press'),
	ohp: exercise('ex-ohp001', 'Overhead Press'),
	lat: exercise('ex-latr01', 'Lateral Raise'),
	squat: exercise('ex-squat1', 'Back Squat'),
	rdl: exercise('ex-rdl001', 'Romanian Deadlift'),
	pull: exercise('ex-pull01', 'Pull Up'),
};

function template(id: string, name: string, entries: [Exercise, number, number, number][]): Template {
	return {
		type: 'workout-template',
		template_id: id,
		name,
		created: addDays(today, -50),
		updated: addDays(today, -10),
		exercises: entries.map(([ex, sets, reps, weight], i) => ({
			uid: `e-${id.slice(4)}${i}`,
			exercise_id: ex.exercise_id,
			name: ex.name,
			order: i + 1,
			sets: Array.from({ length: sets }, (_, s) => ({ set: s + 1, reps, weight })),
		})),
	};
}

const push = template('tpl-push01', 'Push Day', [
	[EX.bench, 4, 8, 80],
	[EX.ohp, 3, 10, 45],
	[EX.lat, 3, 15, 10],
]);
const legs = template('tpl-legs01', 'Leg Day', [
	[EX.squat, 4, 6, 100],
	[EX.rdl, 3, 10, 80],
	[EX.pull, 3, 8, 0],
]);

function workout(tpl: Template, date: string, progress: number, status: Workout['status']): Workout {
	let n = 0;
	const total = tpl.exercises.reduce((a, e) => a + e.sets.length, 0);
	return {
		type: 'workout',
		workout_id: `wkt-${date.replace(/-/g, '').slice(2)}`,
		template_id: tpl.template_id,
		status,
		started: `${date}T18:00:00`,
		completed: status === 'completed' ? `${date}T19:05:00` : null,
		current_phase_started: status === 'in_progress' ? nowISODateTime(new Date(Date.now() - 75_000)) : null,
		exercises: tpl.exercises.map((e) => ({
			...e,
			sets: e.sets.map((s) => {
				const done = n++ < Math.round(total * progress);
				return {
					set: s.set,
					reps: s.reps,
					weight: s.weight + (done ? 2.5 : 0),
					done,
					started: done ? `${date}T18:${String(10 + n * 3).padStart(2, '0')}:00` : null,
					duration_seconds: done ? 40 + n : null,
				};
			}),
		})),
	};
}

function answer(item: JournalItem, date: string, patch: Partial<JournalAnswer>): JournalAnswer {
	return { ...emptyAnswer(item, true), ...patch, time: patch.time ? `${date}T${patch.time}:00` : null };
}

async function seed(): Promise<void> {
	if (params.get('seed') === 'empty') return;

	for (const ex of Object.values(EX)) await write(`${paths.exercises}/${ex.name}.md`, serializeExercise(ex));
	await write(`${paths.templates}/Push Day.md`, serializeTemplate(push));
	await write(`${paths.templates}/Leg Day.md`, serializeTemplate(legs));

	for (let i = 1; i <= 8; i++) {
		const date = addDays(today, -i * 3);
		const tpl = i % 2 ? push : legs;
		const name = `${date} ${tpl.name}`;
		await write(`${paths.completed}/${name}.md`, serializeWorkout(workout(tpl, date, 1, 'completed'), name));
	}
	if (params.get('active') === '1') {
		const name = `${today} Push Day`;
		await write(`${paths.active}/${name}.md`, serializeWorkout(workout(push, today, 0.4, 'in_progress'), name));
	}

	await write(
		paths.bodyWeightFile,
		serializeBodyWeight(
			Array.from({ length: 10 }, (_, i) => ({
				id: `bw-seed0${i}`,
				weight: Math.round((82.4 - i * 0.15 + (i % 3) * 0.2) * 10) / 10,
				at: `${addDays(today, -i * 2)}T07:3${i % 10}:00`,
			})),
		),
	);

	const items: JournalItem[] = [
		...builtinItems(),
		{
			item_id: 'ji-headac',
			name: 'Headache',
			hint: 'When it started and stopped, and how strong it was.',
			builtin: false,
			enabled: true,
			repeatable: true,
			order: 8,
			fields: ['start', 'end', 'intensity', 'note'],
			count_unit: '',
			dosage_unit: 'mg',
		},
		{
			item_id: 'ji-magnes',
			name: 'Magnesium glycinate',
			hint: '',
			builtin: false,
			enabled: true,
			repeatable: true,
			order: 9,
			fields: ['time', 'dosage'],
			count_unit: '',
			dosage_unit: 'mg',
		},
		{
			item_id: 'ji-alcoho',
			name: 'Alcohol',
			hint: 'Drinks and time of the last one.',
			builtin: false,
			enabled: false,
			repeatable: false,
			order: 10,
			fields: ['time', 'count'],
			count_unit: 'drinks',
			dosage_unit: 'mg',
		},
	];
	items.forEach((it, i) => (it.order = i + 1));
	await write(paths.journalItemsFile, serializeJournalItems(items));
	const byId = Object.fromEntries(items.map((it) => [it.item_id, it]));

	const y = addDays(today, -1);
	await write(
		`${paths.journalDays}/${y}.md`,
		serializeJournalDay({
			type: 'journal',
			date: y,
			updated: `${y}T22:40:00`,
			entries: [
				answer(byId.caffeine, y, { time: '14:30', count: 3, count_unit: 'cups' }),
				answer(byId.cold_shower, y, { answer: false }),
				{ ...answer(byId.sauna, y, {}), end: `${y}T20:15:00`, duration_min: 25 },
				answer(byId.mobility, y, { time: '07:10', duration_min: 15, note: 'Hips, thoracic spine' }),
				{ ...answer(byId['ji-headac'], y, {}), start: `${y}T22:00:00`, end: `${today}T01:30:00`, intensity: 6 },
				{ ...answer(byId['ji-headac'], y, {}), start: `${y}T09:00:00`, end: `${y}T10:15:00`, intensity: 3 },
				answer(byId['ji-magnes'], y, { time: '22:30', dosage: 400, dosage_unit: 'mg' }),
			],
		}),
	);
}

// --- Boot -----------------------------------------------------------------

async function boot(): Promise<void> {
	await seed();
	const plugin = new GymMDPlugin(app as never, { id: 'gymmd', version: 'preview' } as never);
	await plugin.onload();
	const route = (params.get('route') ?? 'home') as Route;
	await plugin.openApp(route === 'home' ? undefined : route);
	(window as unknown as { gymmd: unknown }).gymmd = { app, plugin };
	document.body.setAttr('data-ready', '1');
}

void boot();

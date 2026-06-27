import type { Workout } from '../types';

/**
 * Builds a coach-friendly progress report (markdown) from completed workouts.
 * Pure — no vault access — so it's easy to test and reason about.
 *
 * The report is designed to surface progressive-overload signals at a glance:
 * an overview table of every exercise's trend, highlights of what's improving
 * vs. stalling, and a compact recent-session table per exercise.
 */

export interface ReportEntry {
	date: string; // YYYY-MM-DD
	workout: Workout;
}

export interface ReportInput {
	generatedAt: string;
	rangeLabel: string;
	entries: ReportEntry[];
	/** null = all exercises */
	exerciseIds: Set<string> | null;
}

interface SetLite {
	reps: number;
	weight: number;
}

interface SessionStat {
	date: string;
	top: SetLite; // heaviest set (max weight, then reps)
	e1rm: number; // best estimated 1RM this session (0 if bodyweight)
	maxReps: number;
	volume: number; // Σ reps×weight
	totalReps: number; // Σ reps
}

interface ExerciseStat {
	id: string;
	name: string;
	weighted: boolean;
	sessions: SessionStat[]; // ascending by date
}

const RECENT_LIMIT = 10;

function epley(weight: number, reps: number): number {
	return weight > 0 ? Math.round(weight * (1 + reps / 30)) : 0;
}

function fmt(n: number): string {
	return Math.round(n).toLocaleString('en-US');
}

function setLabel(s: SetLite): string {
	return `${s.weight === 0 ? 'BW' : fmt(s.weight)} × ${s.reps}`;
}

function trendIcon(delta: number): string {
	if (delta > 0) return '📈';
	if (delta < 0) return '📉';
	return '➡️';
}

function collect(input: ReportInput): ExerciseStat[] {
	const byId = new Map<string, ExerciseStat>();
	const sorted = [...input.entries].sort((a, b) => a.date.localeCompare(b.date));

	for (const { date, workout } of sorted) {
		for (const ex of workout.exercises) {
			if (input.exerciseIds && !input.exerciseIds.has(ex.exercise_id)) continue;
			const sets: SetLite[] = ex.sets
				.filter((s) => s.done && s.reps != null)
				.map((s) => ({ reps: s.reps ?? 0, weight: s.weight ?? 0 }));
			if (sets.length === 0) continue;

			let stat = byId.get(ex.exercise_id);
			if (!stat) {
				stat = { id: ex.exercise_id, name: ex.name, weighted: false, sessions: [] };
				byId.set(ex.exercise_id, stat);
			}
			stat.name = ex.name;
			if (sets.some((s) => s.weight > 0)) stat.weighted = true;

			const top = sets.reduce((a, b) =>
				b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a,
			);
			stat.sessions.push({
				date,
				top,
				e1rm: Math.max(0, ...sets.map((s) => epley(s.weight, s.reps))),
				maxReps: Math.max(...sets.map((s) => s.reps)),
				volume: sets.reduce((n, s) => n + s.reps * s.weight, 0),
				totalReps: sets.reduce((n, s) => n + s.reps, 0),
			});
		}
	}

	return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function metricOf(ex: ExerciseStat, s: SessionStat): number {
	return ex.weighted ? s.e1rm : s.maxReps;
}

function unitOf(ex: ExerciseStat): string {
	return ex.weighted ? 'kg' : 'reps';
}

interface Derived {
	first: number;
	latest: number;
	best: SessionStat;
	delta: number;
	pct: number;
	perWeek: number;
}

function derive(ex: ExerciseStat): Derived {
	const sessions = ex.sessions;
	const first = metricOf(ex, sessions[0]);
	const latest = metricOf(ex, sessions[sessions.length - 1]);
	const best = sessions.reduce((a, b) => (metricOf(ex, b) > metricOf(ex, a) ? b : a));
	const delta = latest - first;
	const pct = first > 0 ? Math.round((delta / first) * 100) : 0;
	const fromMs = Date.parse(sessions[0].date);
	const toMs = Date.parse(sessions[sessions.length - 1].date);
	const weeks = Math.max((toMs - fromMs) / (7 * 86400000), 1);
	const perWeek = sessions.length / weeks;
	return { first, latest, best, delta, pct, perWeek };
}

function frontmatter(input: ReportInput, exercises: ExerciseStat[], from: string, to: string): string {
	return [
		'---',
		'type: workout-report',
		`generated: "${input.generatedAt}"`,
		`range: ${input.rangeLabel}`,
		`from: ${from || ''}`,
		`to: ${to || ''}`,
		`workouts: ${input.entries.length}`,
		`exercises: ${exercises.length}`,
		'---',
		'',
	].join('\n');
}

export function buildReportMarkdown(input: ReportInput): string {
	const exercises = collect(input);
	const today = input.generatedAt.slice(0, 10);

	if (exercises.length === 0) {
		return (
			frontmatter(input, exercises, '', '') +
			`# Workout report — ${today}\n\nNo completed sets found for the selected range/exercises.\n`
		);
	}

	const allDates = input.entries.map((e) => e.date).sort();
	const from = allDates[0];
	const to = allDates[allDates.length - 1];
	const totalVolume = exercises.reduce(
		(n, ex) => n + ex.sessions.reduce((m, s) => m + s.volume, 0),
		0,
	);
	const spanWeeks = Math.max((Date.parse(to) - Date.parse(from)) / (7 * 86400000), 1);
	const perWeek = (input.entries.length / spanWeeks).toFixed(1);

	const derived = new Map(exercises.map((ex) => [ex.id, derive(ex)]));
	const out: string[] = [];

	out.push(frontmatter(input, exercises, from, to));
	out.push(`# Workout report — ${today}`, '');
	out.push(`_Range: **${input.rangeLabel}** · ${from} → ${to}_`, '');

	// Summary
	out.push('## Summary', '');
	out.push(`- **${input.entries.length} workouts** · ~${perWeek}/week`);
	out.push(`- **${exercises.length} exercises** tracked`);
	out.push(`- Total volume: **${fmt(totalVolume)} kg**`, '');

	// Highlights
	const improving = exercises
		.filter((ex) => (derived.get(ex.id) as Derived).delta > 0)
		.sort((a, b) => (derived.get(b.id) as Derived).pct - (derived.get(a.id) as Derived).pct)
		.slice(0, 3);
	const watch = exercises.filter((ex) => {
		const d = derived.get(ex.id) as Derived;
		return ex.sessions.length >= 3 && d.delta <= 0;
	});

	if (improving.length || watch.length) {
		out.push('## Highlights', '');
		for (const ex of improving) {
			const d = derived.get(ex.id) as Derived;
			out.push(`- 📈 **${ex.name}** +${fmt(d.delta)} ${unitOf(ex)} (+${d.pct}%)`);
		}
		for (const ex of watch) {
			out.push(`- ⚠️ **${ex.name}** stalling — no gain over last ${ex.sessions.length} sessions`);
		}
		out.push('');
	}

	// Overview table
	out.push('## Overview', '');
	out.push('| Exercise | Sessions | Best | First → Latest | Trend |');
	out.push('|---|---|---|---|---|');
	for (const ex of exercises) {
		const d = derived.get(ex.id) as Derived;
		const unit = unitOf(ex);
		const sign = d.delta > 0 ? '+' : '';
		out.push(
			`| ${ex.name} | ${ex.sessions.length} | ${fmt(metricOf(ex, d.best))} ${unit} | ${fmt(d.first)} → ${fmt(d.latest)} ${unit} | ${sign}${fmt(d.delta)} (${sign}${d.pct}%) ${trendIcon(d.delta)} |`,
		);
	}
	out.push('');

	// Per-exercise detail
	out.push('## Per-exercise detail', '');
	for (const ex of exercises) {
		const d = derived.get(ex.id) as Derived;
		const unit = unitOf(ex);
		const sign = d.delta > 0 ? '+' : '';
		out.push(`### ${ex.name}`, '');
		out.push(
			`Sessions: **${ex.sessions.length}** · ${ex.sessions[0].date} → ${ex.sessions[ex.sessions.length - 1].date} · ~${d.perWeek.toFixed(1)}×/week  `,
		);
		const prMetric = ex.weighted ? `e1RM ${fmt(d.best.e1rm)} kg` : `${d.best.maxReps} reps`;
		out.push(`Best: **${setLabel(d.best.top)}** (${prMetric}) on ${d.best.date}  `);
		out.push(
			`Trend: ${fmt(d.first)} → ${fmt(d.latest)} ${unit} (**${sign}${fmt(d.delta)}**, ${sign}${d.pct}%) ${trendIcon(d.delta)}`,
			'',
		);

		const recent = [...ex.sessions].reverse().slice(0, RECENT_LIMIT);
		if (ex.weighted) {
			out.push('| Date | Top set | e1RM (kg) | Volume (kg) |', '|---|---|---|---|');
			for (const s of recent) {
				out.push(`| ${s.date} | ${setLabel(s.top)} | ${fmt(s.e1rm)} | ${fmt(s.volume)} |`);
			}
		} else {
			out.push('| Date | Top set | Max reps | Total reps |', '|---|---|---|---|');
			for (const s of recent) {
				out.push(`| ${s.date} | ${setLabel(s.top)} | ${s.maxReps} | ${s.totalReps} |`);
			}
		}
		if (ex.sessions.length > RECENT_LIMIT) {
			out.push('', `_Showing last ${RECENT_LIMIT} of ${ex.sessions.length} sessions._`);
		}
		out.push('');
	}

	return out.join('\n');
}

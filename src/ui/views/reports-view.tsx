import { Notice } from 'obsidian';
import { type ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { todayISODate, nowISODateTime } from '../../utils/date';
import { buildReportMarkdown, type ReportEntry } from '../../services/report';
import { usePlugin } from '../context';

type Range = 'all' | '30d' | '90d' | '365d';

const RANGE_LABELS: Record<Range, string> = {
	all: 'all time',
	'30d': 'last 30 days',
	'90d': 'last 90 days',
	'365d': 'last 12 months',
};

function cutoffDate(range: Range): string | null {
	if (range === 'all') return null;
	const days = range === '30d' ? 30 : range === '90d' ? 90 : 365;
	const d = new Date();
	d.setDate(d.getDate() - days);
	return todayISODate(d);
}

interface ExerciseOption {
	id: string;
	name: string;
	sessions: number;
}

export function Reports(): ReactElement {
	const plugin = usePlugin();
	const [entries, setEntries] = useState<ReportEntry[]>([]);
	const [options, setOptions] = useState<ExerciseOption[]>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [range, setRange] = useState<Range>('all');
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		const list = await plugin.workouts.listCompleted();
		const es: ReportEntry[] = list.map((e) => ({
			date: e.file.basename.slice(0, 10),
			workout: e.workout,
		}));
		setEntries(es);

		const map = new Map<string, ExerciseOption>();
		for (const { workout } of es) {
			const seen = new Set<string>();
			for (const ex of workout.exercises) {
				if (!ex.sets.some((s) => s.done)) continue;
				if (seen.has(ex.exercise_id)) continue;
				seen.add(ex.exercise_id);
				const cur = map.get(ex.exercise_id) ?? { id: ex.exercise_id, name: ex.name, sessions: 0 };
				cur.name = ex.name;
				cur.sessions += 1;
				map.set(ex.exercise_id, cur);
			}
		}
		const opts = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
		setOptions(opts);
		setSelected(new Set(opts.map((o) => o.id)));
	}, [plugin]);

	useEffect(() => {
		void load();
	}, [load]);

	const inRangeCount = useMemo(() => {
		const cut = cutoffDate(range);
		return entries.filter((e) => cut === null || e.date >= cut).length;
	}, [entries, range]);

	const toggle = (id: string) =>
		setSelected((s) => {
			const next = new Set(s);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	const onGenerate = async () => {
		setBusy(true);
		try {
			const cut = cutoffDate(range);
			const filtered = entries.filter((e) => cut === null || e.date >= cut);
			const exerciseIds = selected.size === options.length ? null : new Set(selected);
			const markdown = buildReportMarkdown({
				generatedAt: nowISODateTime(),
				rangeLabel: RANGE_LABELS[range],
				entries: filtered,
				exerciseIds,
			});
			const file = await plugin.reports.write(markdown);
			new Notice('Report generated');
			await plugin.app.workspace.getLeaf(false).openFile(file);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="gymmd-view">
			<div className="gymmd-header">
				<h2>Reports</h2>
				<button
					className="mod-cta"
					disabled={busy || entries.length === 0}
					onClick={() => void onGenerate()}
				>
					Generate
				</button>
			</div>

			{entries.length === 0 ? (
				<p className="gymmd-empty">No completed workouts yet — finish a workout first.</p>
			) : (
				<>
					<div className="gymmd-field">
						<label>
							Time range
							<select value={range} onChange={(e) => setRange(e.target.value as Range)}>
								<option value="all">All time</option>
								<option value="30d">Last 30 days</option>
								<option value="90d">Last 90 days</option>
								<option value="365d">Last 12 months</option>
							</select>
						</label>
						<span className="gymmd-muted">{inRangeCount} workouts in range</span>
					</div>

					<div className="gymmd-field-head">
						<strong>Exercises</strong>
						<span className="gymmd-row-actions">
							<button onClick={() => setSelected(new Set(options.map((o) => o.id)))}>All</button>
							<button onClick={() => setSelected(new Set())}>None</button>
						</span>
					</div>

					<ul className="gymmd-list">
						{options.map((o) => (
							<li key={o.id} className="gymmd-list-row">
								<label className="gymmd-checkbox">
									<input
										type="checkbox"
										checked={selected.has(o.id)}
										onChange={() => toggle(o.id)}
									/>
									{o.name}
								</label>
								<span className="gymmd-muted">{o.sessions} sessions</span>
							</li>
						))}
					</ul>
				</>
			)}
		</div>
	);
}

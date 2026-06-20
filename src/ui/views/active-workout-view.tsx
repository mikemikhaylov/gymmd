import { Notice } from 'obsidian';
import { type ReactElement, useEffect, useMemo, useState } from 'react';
import type { Workout } from '../../types';
import { VIEW_TYPE_ACTIVE_WORKOUT, VIEW_TYPE_TEMPLATES } from '../../utils/constants';
import { nowISODateTime, parseISODateTime, formatStopwatch } from '../../utils/date';
import { usePlugin } from '../context';
import { useActiveWorkout, type ActiveWorkoutController } from '../hooks/use-active-workout';
import { useNow } from '../hooks/use-now';
import { confirm } from '../modals/prompts';
import { runFinishFlow } from '../modals/finish-flow';
import { ReactItemView } from './react-view';

interface Ref {
	e: number;
	s: number;
}

function weightLabel(w: number | null): string {
	if (w === null) return '—';
	return w === 0 ? 'BW' : String(w);
}

function firstNotDone(w: Workout): Ref | null {
	for (let e = 0; e < w.exercises.length; e++) {
		for (let s = 0; s < w.exercises[e].sets.length; s++) {
			if (!w.exercises[e].sets[s].done) return { e, s };
		}
	}
	return null;
}

function numFromInput(value: string): number | null {
	if (value.trim() === '') return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

// --- Stopwatch tab --------------------------------------------------------

function StopwatchTab({
	ctrl,
	workout,
	cursor,
	setCursor,
	activeRef,
	setActiveRef,
}: {
	ctrl: ActiveWorkoutController;
	workout: Workout;
	cursor: Ref;
	setCursor: (r: Ref) => void;
	activeRef: Ref | null;
	setActiveRef: (r: Ref | null) => void;
}): ReactElement {
	const running = workout.current_phase_started !== null;
	const now = useNow(running);
	const anchor = parseISODateTime(workout.current_phase_started);
	const elapsed = running && anchor !== null ? Math.max(0, (now - anchor) / 1000) : 0;

	const exercise = workout.exercises[cursor.e];
	const set = exercise?.sets[cursor.s];
	if (!exercise || !set) return <p>No set selected.</p>;

	const isActive = !!activeRef && activeRef.e === cursor.e && activeRef.s === cursor.s;

	const startSet = () => {
		const ts = nowISODateTime();
		ctrl.mutate((w) => {
			const t = w.exercises[cursor.e].sets[cursor.s];
			t.started = ts;
			if (t.reps === null) t.reps = t.planned_reps;
			if (t.weight === null) t.weight = t.planned_weight;
			w.current_phase_started = ts;
			if (!w.started) w.started = ts;
		});
		setActiveRef(cursor);
	};

	const endSet = () => {
		const next = ((): Ref => {
			for (let e = 0; e < workout.exercises.length; e++) {
				for (let s = 0; s < workout.exercises[e].sets.length; s++) {
					const isCurrent = e === cursor.e && s === cursor.s;
					if (!workout.exercises[e].sets[s].done && !isCurrent) return { e, s };
				}
			}
			return cursor;
		})();

		ctrl.mutate((w) => {
			const t = w.exercises[cursor.e].sets[cursor.s];
			const startedMs = parseISODateTime(t.started);
			t.duration_seconds =
				startedMs !== null ? Math.max(0, Math.round((Date.now() - startedMs) / 1000)) : null;
			t.done = true;
			w.current_phase_started = nowISODateTime();
		});
		setActiveRef(null);
		setCursor(next);
	};

	const editCursor = (field: 'reps' | 'weight', value: number | null) =>
		ctrl.mutate((w) => {
			w.exercises[cursor.e].sets[cursor.s][field] = value;
		});

	const flat: Ref[] = [];
	workout.exercises.forEach((ex, e) => ex.sets.forEach((_, s) => flat.push({ e, s })));
	const pos = flat.findIndex((r) => r.e === cursor.e && r.s === cursor.s);
	const goto = (delta: number) => {
		const j = pos + delta;
		if (j >= 0 && j < flat.length) setCursor(flat[j]);
	};

	return (
		<div className="gymmd-stopwatch">
			<div className="gymmd-current-exercise">{exercise.name}</div>
			<div className="gymmd-set-indicator">
				Set {cursor.s + 1} of {exercise.sets.length}
			</div>

			<div className="gymmd-timer">{formatStopwatch(elapsed)}</div>

			<div className="gymmd-planned">
				Plan: {set.planned_reps ?? '—'} reps × {weightLabel(set.planned_weight)} kg
			</div>

			<div className="gymmd-inputs">
				<label>
					Reps
					<input
						type="number"
						min={0}
						disabled={!isActive}
						value={set.reps ?? ''}
						onChange={(e) => editCursor('reps', numFromInput(e.target.value))}
					/>
				</label>
				<label>
					Weight (kg)
					<input
						type="number"
						min={0}
						step="0.5"
						disabled={!isActive}
						value={set.weight ?? ''}
						onChange={(e) => editCursor('weight', numFromInput(e.target.value))}
					/>
				</label>
			</div>

			<button className="gymmd-big-button" onClick={isActive ? endSet : startSet}>
				{isActive ? 'End set' : set.done ? 'Redo set' : 'Start set'}
			</button>

			<div className="gymmd-nav">
				<button onClick={() => goto(-1)} disabled={pos <= 0}>
					‹ Prev
				</button>
				<button onClick={() => goto(1)} disabled={pos >= flat.length - 1}>
					Next ›
				</button>
			</div>
		</div>
	);
}

// --- All-sets tab ---------------------------------------------------------

function AllSetsTab({
	ctrl,
	workout,
}: {
	ctrl: ActiveWorkoutController;
	workout: Workout;
}): ReactElement {
	const editSet = (e: number, s: number, field: 'reps' | 'weight', value: number | null) =>
		ctrl.mutate((w) => {
			w.exercises[e].sets[s][field] = value;
		});

	const toggleDone = (e: number, s: number) =>
		ctrl.mutate((w) => {
			w.exercises[e].sets[s].done = !w.exercises[e].sets[s].done;
		});

	const addSet = (e: number) =>
		ctrl.mutate((w) => {
			const sets = w.exercises[e].sets;
			const last = sets[sets.length - 1];
			sets.push({
				set: sets.length + 1,
				planned_reps: last ? last.planned_reps : null,
				planned_weight: last ? last.planned_weight : null,
				reps: null,
				weight: null,
				done: false,
				started: null,
				duration_seconds: null,
			});
		});

	const removeSet = (e: number, s: number) =>
		ctrl.mutate((w) => {
			w.exercises[e].sets.splice(s, 1);
		});

	const moveSet = (e: number, s: number, delta: number) =>
		ctrl.mutate((w) => {
			const sets = w.exercises[e].sets;
			const j = s + delta;
			if (j < 0 || j >= sets.length) return;
			[sets[s], sets[j]] = [sets[j], sets[s]];
		});

	const moveExercise = (e: number, delta: number) =>
		ctrl.mutate((w) => {
			const j = e + delta;
			if (j < 0 || j >= w.exercises.length) return;
			[w.exercises[e], w.exercises[j]] = [w.exercises[j], w.exercises[e]];
		});

	return (
		<div className="gymmd-allsets">
			{workout.exercises.map((ex, e) => (
				<div key={ex.exercise_id} className="gymmd-exercise-block">
					<div className="gymmd-exercise-head">
						<strong>{ex.name}</strong>
						<span className="gymmd-row-actions">
							<button onClick={() => moveExercise(e, -1)} disabled={e === 0}>
								↑
							</button>
							<button
								onClick={() => moveExercise(e, 1)}
								disabled={e === workout.exercises.length - 1}
							>
								↓
							</button>
						</span>
					</div>
					<table className="gymmd-set-table">
						<thead>
							<tr>
								<th>Set</th>
								<th>Plan</th>
								<th>Reps</th>
								<th>Weight</th>
								<th>Done</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{ex.sets.map((s, si) => (
								<tr key={si} className={s.done ? 'gymmd-done' : ''}>
									<td>{si + 1}</td>
									<td className="gymmd-muted">
										{s.planned_reps ?? '—'}×{weightLabel(s.planned_weight)}
									</td>
									<td>
										<input
											type="number"
											min={0}
											value={s.reps ?? ''}
											onChange={(ev) => editSet(e, si, 'reps', numFromInput(ev.target.value))}
										/>
									</td>
									<td>
										<input
											type="number"
											min={0}
											step="0.5"
											value={s.weight ?? ''}
											onChange={(ev) => editSet(e, si, 'weight', numFromInput(ev.target.value))}
										/>
									</td>
									<td>
										<input
											type="checkbox"
											checked={s.done}
											onChange={() => toggleDone(e, si)}
										/>
									</td>
									<td className="gymmd-row-actions">
										<button onClick={() => moveSet(e, si, -1)} disabled={si === 0}>
											↑
										</button>
										<button onClick={() => moveSet(e, si, 1)} disabled={si === ex.sets.length - 1}>
											↓
										</button>
										<button onClick={() => removeSet(e, si)}>✕</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					<button onClick={() => addSet(e)}>Add set</button>
				</div>
			))}
		</div>
	);
}

// --- Root -----------------------------------------------------------------

function ActiveWorkout(): ReactElement {
	const plugin = usePlugin();
	const ctrl = useActiveWorkout(plugin);
	const [tab, setTab] = useState<'stopwatch' | 'sets'>('stopwatch');
	const [activeRef, setActiveRef] = useState<Ref | null>(null);
	const [rawCursor, setCursor] = useState<Ref | null>(null);

	const workout = ctrl.workout;

	const cursor = useMemo<Ref | null>(() => {
		if (!workout) return null;
		if (
			rawCursor &&
			workout.exercises[rawCursor.e] &&
			workout.exercises[rawCursor.e].sets[rawCursor.s]
		) {
			return rawCursor;
		}
		return firstNotDone(workout) ?? { e: 0, s: 0 };
	}, [workout, rawCursor]);

	useEffect(() => {
		if (workout && !rawCursor) setCursor(firstNotDone(workout) ?? { e: 0, s: 0 });
	}, [workout, rawCursor]);

	if (ctrl.phase === 'loading') {
		return (
			<div className="gymmd-view gymmd-dark">
				<p>Loading…</p>
			</div>
		);
	}

	if (ctrl.phase === 'none' || !workout || !cursor) {
		return (
			<div className="gymmd-view gymmd-dark">
				<h2>No active workout</h2>
				<p className="gymmd-empty">Start one from a template to begin logging.</p>
				<button
					className="mod-cta"
					onClick={() => void plugin.activateView(VIEW_TYPE_TEMPLATES)}
				>
					Choose a template
				</button>
			</div>
		);
	}

	const onFinish = async () => {
		const current = await ctrl.flushAndGet();
		if (!current) return;
		const moved = await runFinishFlow(plugin, current.file, current.workout);
		if (moved) {
			ctrl.clear();
			new Notice('Workout completed');
		}
	};

	const onAbandon = async () => {
		const ok = await confirm(plugin.app, {
			title: 'Abandon workout',
			message: 'Move this workout to Abandoned? Completed sets are preserved.',
			cta: 'Abandon',
			danger: true,
		});
		if (!ok) return;
		const current = await ctrl.flushAndGet();
		if (!current) return;
		await plugin.workouts.abandon(current.file, current.workout);
		ctrl.clear();
		new Notice('Workout abandoned');
	};

	return (
		<div className="gymmd-view gymmd-dark gymmd-active">
			<div className="gymmd-header">
				<h2>{workout.template_name}</h2>
				<span className="gymmd-row-actions">
					<button className="mod-cta" onClick={() => void onFinish()}>
						Finish
					</button>
					<button onClick={() => void onAbandon()}>Abandon</button>
				</span>
			</div>

			<div className="gymmd-progress gymmd-muted">
				{workout.total_sets_completed}/{workout.total_sets_planned} sets ·{' '}
				{workout.total_volume_kg} kg volume
			</div>

			<div className="gymmd-tabs">
				<button
					className={tab === 'stopwatch' ? 'gymmd-tab-active' : ''}
					onClick={() => setTab('stopwatch')}
				>
					Stopwatch
				</button>
				<button
					className={tab === 'sets' ? 'gymmd-tab-active' : ''}
					onClick={() => setTab('sets')}
				>
					All sets
				</button>
			</div>

			{tab === 'stopwatch' ? (
				<StopwatchTab
					ctrl={ctrl}
					workout={workout}
					cursor={cursor}
					setCursor={setCursor}
					activeRef={activeRef}
					setActiveRef={setActiveRef}
				/>
			) : (
				<AllSetsTab ctrl={ctrl} workout={workout} />
			)}
		</div>
	);
}

export class ActiveWorkoutView extends ReactItemView {
	getViewType(): string {
		return VIEW_TYPE_ACTIVE_WORKOUT;
	}

	getDisplayText(): string {
		return 'Active workout';
	}

	getIcon(): string {
		return 'timer';
	}

	protected renderContent(): ReactElement {
		return <ActiveWorkout />;
	}
}

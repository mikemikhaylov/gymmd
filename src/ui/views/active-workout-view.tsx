import { Notice } from 'obsidian';
import { type ReactElement, useState } from 'react';
import type { Workout } from '../../types';
import { nowISODateTime, parseISODateTime, formatStopwatch } from '../../utils/date';
import { usePlugin } from '../context';
import { useNav } from '../navigation';
import { useActiveWorkout, type ActiveWorkoutController } from '../hooks/use-active-workout';
import { useNow } from '../hooks/use-now';
import { confirm } from '../modals/prompts';
import { runFinishFlow } from '../modals/finish-flow';
import { NumberField } from '../components/number-field';

interface Ref {
	e: number;
	s: number;
}

function firstNotDone(w: Workout): Ref | null {
	for (let e = 0; e < w.exercises.length; e++) {
		for (let s = 0; s < w.exercises[e].sets.length; s++) {
			if (!w.exercises[e].sets[s].done) return { e, s };
		}
	}
	return null;
}

function sameRef(a: Ref | null, b: Ref | null): boolean {
	return !!a && !!b && a.e === b.e && a.s === b.s;
}

interface SetActions {
	ctrl: ActiveWorkoutController;
	activeRef: Ref | null;
	startSetAt: (ref: Ref) => void;
	endActiveSet: () => void;
	onFinish: () => void;
}

// --- Stopwatch tab --------------------------------------------------------

function StopwatchTab({
	workout,
	actions,
}: {
	workout: Workout;
	actions: SetActions;
}): ReactElement {
	const { ctrl, activeRef, startSetAt, endActiveSet, onFinish } = actions;

	const running = workout.current_phase_started !== null;
	const now = useNow(running);
	const anchor = parseISODateTime(workout.current_phase_started);
	const elapsed = running && anchor !== null ? Math.max(0, (now - anchor) / 1000) : 0;

	const activeValid = !!activeRef && !!workout.exercises[activeRef.e]?.sets[activeRef.s];
	const displayRef = activeValid ? activeRef : firstNotDone(workout);
	const isActive = activeValid;

	const editField = (field: 'reps' | 'weight', value: number | null) => {
		if (!displayRef) return;
		ctrl.mutate((w) => {
			w.exercises[displayRef.e].sets[displayRef.s][field] = value;
		});
	};

	return (
		<div className={isActive ? 'gymmd-stopwatch gymmd-running' : 'gymmd-stopwatch'}>
			<div className="gymmd-timer">{formatStopwatch(elapsed)}</div>

			{displayRef ? (
				<>
					<div className="gymmd-current-exercise">
						{workout.exercises[displayRef.e].name}
					</div>
					<div className="gymmd-set-indicator">
						Set {displayRef.s + 1} of {workout.exercises[displayRef.e].sets.length}
						{isActive ? ' · in progress' : ''}
					</div>
				</>
			) : (
				<div className="gymmd-all-done">All sets done — finish your workout.</div>
			)}

			<div className="gymmd-stopwatch-footer">
				{displayRef && (
					<div className="gymmd-inputs">
						<label>
							Reps
							<NumberField
								kind="reps"
								value={workout.exercises[displayRef.e].sets[displayRef.s].reps}
								onChange={(v) => editField('reps', v)}
							/>
						</label>
						<label>
							Weight (kg)
							<NumberField
								kind="weight"
								value={workout.exercises[displayRef.e].sets[displayRef.s].weight}
								onChange={(v) => editField('weight', v)}
							/>
						</label>
					</div>
				)}
				{!displayRef ? (
					<button className="gymmd-big-button" onClick={onFinish}>
						Finish workout
					</button>
				) : isActive ? (
					<button className="gymmd-big-button gymmd-end" onClick={endActiveSet}>
						End set
					</button>
				) : (
					<button className="gymmd-big-button" onClick={() => startSetAt(displayRef)}>
						Start set
					</button>
				)}
			</div>
		</div>
	);
}

// --- All-sets tab ---------------------------------------------------------

function AllSetsTab({
	workout,
	actions,
}: {
	workout: Workout;
	actions: SetActions;
}): ReactElement {
	const plugin = usePlugin();
	const { ctrl, activeRef, startSetAt } = actions;

	const editSet = (e: number, s: number, field: 'reps' | 'weight', value: number | null) =>
		ctrl.mutate((w) => {
			w.exercises[e].sets[s][field] = value;
		});

	const undoSet = (e: number, s: number) =>
		ctrl.mutate((w) => {
			const t = w.exercises[e].sets[s];
			t.done = false;
			t.started = null;
			t.duration_seconds = null;
		});

	const addSet = (e: number) =>
		ctrl.mutate((w) => {
			const sets = w.exercises[e].sets;
			const last = sets[sets.length - 1];
			sets.push({
				set: sets.length + 1,
				reps: last ? last.reps : null,
				weight: last ? last.weight : null,
				done: false,
				started: null,
				duration_seconds: null,
			});
		});

	const removeSet = async (e: number, s: number) => {
		const ok = await confirm(plugin.app, {
			title: 'Delete set',
			message: 'Delete this set from the workout?',
			cta: 'Delete',
			danger: true,
		});
		if (!ok) return;
		ctrl.mutate((w) => {
			w.exercises[e].sets.splice(s, 1);
		});
	};

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
				<div key={ex.uid} className="gymmd-exercise-block">
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
					<div className="gymmd-table-wrap">
					<table className="gymmd-set-table">
						<thead>
							<tr>
								<th>Set</th>
								<th>Reps</th>
								<th>Weight</th>
								<th>Status</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{ex.sets.map((s, si) => {
								const active = sameRef(activeRef, { e, s: si });
								return (
									<tr key={si} className={s.done ? 'gymmd-done' : ''}>
										<td>{si + 1}</td>
										<td>
											<NumberField
												kind="reps"
												value={s.reps}
												onChange={(v) => editSet(e, si, 'reps', v)}
											/>
										</td>
										<td>
											<NumberField
												kind="weight"
												value={s.weight}
												onChange={(v) => editSet(e, si, 'weight', v)}
											/>
										</td>
										<td>
											{s.done ? (
												<button onClick={() => undoSet(e, si)}>✓ Done · undo</button>
											) : active ? (
												<span className="gymmd-inprogress">● active</span>
											) : (
												<button className="mod-cta" onClick={() => startSetAt({ e, s: si })}>
													Start
												</button>
											)}
										</td>
										<td className="gymmd-row-actions">
											<button onClick={() => moveSet(e, si, -1)} disabled={si === 0}>
												↑
											</button>
											<button onClick={() => moveSet(e, si, 1)} disabled={si === ex.sets.length - 1}>
												↓
											</button>
											<button onClick={() => void removeSet(e, si)}>✕</button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
					</div>
					<button onClick={() => addSet(e)}>Add set</button>
				</div>
			))}
		</div>
	);
}

// --- Root -----------------------------------------------------------------

export function ActiveWorkout(): ReactElement {
	const plugin = usePlugin();
	const nav = useNav();
	const ctrl = useActiveWorkout(plugin);
	const [tab, setTab] = useState<'stopwatch' | 'sets'>('stopwatch');
	const [activeRef, setActiveRef] = useState<Ref | null>(null);

	const workout = ctrl.workout;

	if (ctrl.phase === 'loading') {
		return (
			<div className="gymmd-view">
				<p>Loading…</p>
			</div>
		);
	}

	if (ctrl.phase === 'none' || !workout) {
		return (
			<div className="gymmd-view">
				<h2>No active workout</h2>
				<p className="gymmd-empty">Start one from a template to begin logging.</p>
				<button className="mod-cta" onClick={() => nav.navigate('templates')}>
					Choose a template
				</button>
			</div>
		);
	}

	const startSetAt = (ref: Ref) => {
		const ts = nowISODateTime();
		ctrl.mutate((w) => {
			const t = w.exercises[ref.e].sets[ref.s];
			t.started = ts;
			w.current_phase_started = ts;
			if (!w.started) w.started = ts;
		});
		setActiveRef(ref);
		setTab('stopwatch');
	};

	const endActiveSet = () => {
		if (!activeRef) return;
		ctrl.mutate((w) => {
			const t = w.exercises[activeRef.e].sets[activeRef.s];
			const startedMs = parseISODateTime(t.started);
			t.duration_seconds =
				startedMs !== null ? Math.max(0, Math.round((Date.now() - startedMs) / 1000)) : null;
			t.done = true;
			w.current_phase_started = nowISODateTime();
		});
		setActiveRef(null);
	};

	const onFinish = async () => {
		const ok = await confirm(plugin.app, {
			title: 'Finish workout',
			message: 'Finish this workout and move it to completed?',
			cta: 'Finish',
		});
		if (!ok) return;
		const current = await ctrl.flushAndGet();
		if (!current) return;
		const moved = await runFinishFlow(plugin, current.file, current.workout);
		if (moved) {
			ctrl.clear();
			new Notice('Workout completed');
			nav.home();
		}
	};

	const actions: SetActions = { ctrl, activeRef, startSetAt, endActiveSet, onFinish: () => void onFinish() };

	return (
		<div className="gymmd-view gymmd-active">
			<div className="gymmd-header">
				<h2>{ctrl.title}</h2>
				<button className="mod-cta" onClick={() => void onFinish()}>
					Finish
				</button>
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

			<div className="gymmd-tabcontent">
				{tab === 'stopwatch' ? (
					<StopwatchTab workout={workout} actions={actions} />
				) : (
					<AllSetsTab workout={workout} actions={actions} />
				)}
			</div>
		</div>
	);
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TFile } from 'obsidian';
import type { Workout } from '../../types';
import { AUTOSAVE_DEBOUNCE_MS } from '../../utils/constants';
import type GymMDPlugin from '../../main';

type Phase = 'loading' | 'none' | 'ready';

interface Loaded {
	file: TFile;
	workout: Workout;
}

export interface ActiveWorkoutController {
	phase: Phase;
	workout: Workout | null;
	/** Display title for the workout (its file name). */
	title: string | null;
	mutate: (fn: (w: Workout) => void) => void;
	/** Cancel any pending autosave and return the latest in-memory state. */
	flushAndGet: () => Promise<Loaded | null>;
	/** Forget the active workout locally (after finish). */
	clear: () => void;
}

export function useActiveWorkout(plugin: GymMDPlugin): ActiveWorkoutController {
	const [phase, setPhase] = useState<Phase>('loading');
	const [state, setState] = useState<Loaded | null>(null);
	const latest = useRef<Loaded | null>(null);
	const saveTimer = useRef<number | null>(null);

	useEffect(() => {
		latest.current = state;
	}, [state]);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const active = await plugin.workouts.findActive();
			if (cancelled) return;
			if (active) {
				setState({ file: active.file, workout: active.workout });
				setPhase('ready');
			} else {
				setPhase('none');
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [plugin]);

	const scheduleSave = useCallback(
		(loaded: Loaded) => {
			if (saveTimer.current) window.clearTimeout(saveTimer.current);
			saveTimer.current = window.setTimeout(() => {
				void plugin.workouts.save(loaded.file, loaded.workout);
				saveTimer.current = null;
			}, AUTOSAVE_DEBOUNCE_MS);
		},
		[plugin],
	);

	const mutate = useCallback(
		(fn: (w: Workout) => void) => {
			setState((prev) => {
				if (!prev) return prev;
				const workout = structuredClone(prev.workout);
				fn(workout);
				const next = { file: prev.file, workout };
				scheduleSave(next);
				return next;
			});
		},
		[scheduleSave],
	);

	const flushAndGet = useCallback(async (): Promise<Loaded | null> => {
		if (saveTimer.current) {
			window.clearTimeout(saveTimer.current);
			saveTimer.current = null;
		}
		const current = latest.current;
		if (current) await plugin.workouts.save(current.file, current.workout);
		return current;
	}, [plugin]);

	const clear = useCallback(() => {
		if (saveTimer.current) {
			window.clearTimeout(saveTimer.current);
			saveTimer.current = null;
		}
		setState(null);
		setPhase('none');
	}, []);

	useEffect(
		() => () => {
			if (saveTimer.current) window.clearTimeout(saveTimer.current);
		},
		[],
	);

	return {
		phase,
		workout: state?.workout ?? null,
		title: state?.file.basename ?? null,
		mutate,
		flushAndGet,
		clear,
	};
}

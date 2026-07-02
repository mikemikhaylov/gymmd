import { Notice } from 'obsidian';
import { type ReactElement, useCallback, useEffect, useState } from 'react';
import type { WorkoutEntry } from '../../services/workout-store';
import type { Workout } from '../../types';
import { usePlugin } from '../context';

/** Derive display stats from a workout (nothing summary-like is stored anymore). */
function summarize(w: Workout): { sets: number; volume: number; minutes: number | null } {
	let sets = 0;
	let volume = 0;
	for (const ex of w.exercises) {
		for (const s of ex.sets) {
			if (s.done) {
				sets += 1;
				volume += (s.reps ?? 0) * (s.weight ?? 0);
			}
		}
	}
	const start = w.started ? Date.parse(w.started) : NaN;
	const end = w.completed ? Date.parse(w.completed) : NaN;
	const minutes =
		Number.isFinite(start) && Number.isFinite(end)
			? Math.max(0, Math.round((end - start) / 60000))
			: null;
	return { sets, volume: Math.round(volume * 100) / 100, minutes };
}

export function History(): ReactElement {
	const plugin = usePlugin();
	const [entries, setEntries] = useState<WorkoutEntry[]>([]);

	const refresh = useCallback(async () => {
		setEntries(await plugin.workouts.listCompleted());
	}, [plugin]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const open = (entry: WorkoutEntry) => {
		void plugin.app.workspace.getLeaf(false).openFile(entry.file);
	};

	const copy = async (entry: WorkoutEntry) => {
		try {
			const content = await plugin.app.vault.read(entry.file);
			await navigator.clipboard.writeText(content);
			new Notice('Workout copied to clipboard');
		} catch {
			new Notice('Could not copy to clipboard');
		}
	};

	return (
		<div className="gymmd-view">
			<div className="gymmd-header">
				<h2>Workout history</h2>
				<button onClick={() => void refresh()}>Refresh</button>
			</div>

			{entries.length === 0 ? (
				<p className="gymmd-empty">No completed workouts yet.</p>
			) : (
				<ul className="gymmd-list">
					{entries.map((entry) => {
						const { sets, volume, minutes } = summarize(entry.workout);
						return (
							<li
								key={entry.file.path}
								className="gymmd-list-row gymmd-clickable"
								onClick={() => open(entry)}
							>
								<span>
									<strong>{entry.file.basename}</strong>
									<span className="gymmd-muted">
										{' '}
										· {minutes != null ? `${minutes} min · ` : ''}
										{sets} sets · {volume} kg
									</span>
								</span>
								<span className="gymmd-row-actions">
									<button
										onClick={(e) => {
											e.stopPropagation();
											void copy(entry);
										}}
									>
										Copy
									</button>
								</span>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

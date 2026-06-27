import { type ReactElement, useCallback, useEffect, useState } from 'react';
import type { ExerciseEntry } from '../../services/exercise-store';
import { usePlugin } from '../context';
import { promptText, confirm } from '../modals/prompts';

export function ExerciseList(): ReactElement {
	const plugin = usePlugin();
	const [entries, setEntries] = useState<ExerciseEntry[]>([]);
	const [showArchived, setShowArchived] = useState(false);

	const refresh = useCallback(async () => {
		setEntries(await plugin.exercises.list(true));
	}, [plugin]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const visible = entries.filter((e) => showArchived || !e.exercise.archived);

	const onAdd = async () => {
		const name = await promptText(plugin.app, {
			title: 'New exercise',
			placeholder: 'Exercise name',
			cta: 'Create',
		});
		if (name) {
			await plugin.exercises.create(name);
			await refresh();
		}
	};

	const onRename = async (entry: ExerciseEntry) => {
		const name = await promptText(plugin.app, {
			title: 'Rename exercise',
			value: entry.exercise.name,
			cta: 'Rename',
		});
		if (name) {
			await plugin.exercises.rename(entry.file, entry.exercise, name);
			await refresh();
		}
	};

	const onToggleArchive = async (entry: ExerciseEntry) => {
		const next = !entry.exercise.archived;
		if (next) {
			const ok = await confirm(plugin.app, {
				title: 'Archive exercise',
				message: `Archive "${entry.exercise.name}"? It stays in historical data but is hidden from pickers.`,
				cta: 'Archive',
			});
			if (!ok) return;
		}
		await plugin.exercises.setArchived(entry.file, entry.exercise, next);
		await refresh();
	};

	return (
		<div className="gymmd-view">
			<div className="gymmd-header">
				<h2>Exercises</h2>
				<button className="mod-cta" onClick={() => void onAdd()}>
					Add exercise
				</button>
			</div>

			<label className="gymmd-checkbox">
				<input
					type="checkbox"
					checked={showArchived}
					onChange={(e) => setShowArchived(e.target.checked)}
				/>
				Show archived
			</label>

			{visible.length === 0 ? (
				<p className="gymmd-empty">No exercises yet. Add your first movement.</p>
			) : (
				<ul className="gymmd-list">
					{visible.map((entry) => (
						<li key={entry.exercise.exercise_id} className="gymmd-list-row">
							<span className={entry.exercise.archived ? 'gymmd-archived' : ''}>
								{entry.exercise.name}
								{entry.exercise.archived ? ' (archived)' : ''}
							</span>
							<span className="gymmd-row-actions">
								<button onClick={() => void onRename(entry)}>Rename</button>
								<button onClick={() => void onToggleArchive(entry)}>
									{entry.exercise.archived ? 'Unarchive' : 'Archive'}
								</button>
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

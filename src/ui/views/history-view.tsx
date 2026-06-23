import { type ReactElement, useCallback, useEffect, useState } from 'react';
import { VIEW_TYPE_HISTORY } from '../../utils/constants';
import type { WorkoutEntry } from '../../services/workout-store';
import { usePlugin } from '../context';
import { ReactItemView } from './react-view';

function History(): ReactElement {
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

	return (
		<div className="gymmd-view gymmd-dark">
			<div className="gymmd-header">
				<h2>Workout history</h2>
				<button onClick={() => void refresh()}>Refresh</button>
			</div>

			{entries.length === 0 ? (
				<p className="gymmd-empty">No completed workouts yet.</p>
			) : (
				<ul className="gymmd-list">
					{entries.map((entry) => {
						const w = entry.workout;
						return (
							<li
								key={entry.file.path}
								className="gymmd-list-row gymmd-clickable"
								onClick={() => open(entry)}
							>
								<span>
									<strong>{w.date}</strong> · {w.template_name}
								</span>
								<span className="gymmd-muted">
									{w.duration_minutes != null ? `${w.duration_minutes} min · ` : ''}
									{w.total_sets_completed} sets · {w.total_volume_kg} kg
								</span>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

export class HistoryView extends ReactItemView {
	getViewType(): string {
		return VIEW_TYPE_HISTORY;
	}

	getDisplayText(): string {
		return 'Workout history';
	}

	getIcon(): string {
		return 'history';
	}

	protected renderContent(): ReactElement {
		return <History />;
	}
}

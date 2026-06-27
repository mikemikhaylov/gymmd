import { type ReactElement, useCallback, useEffect, useState } from 'react';
import {
	VIEW_TYPE_HOME,
	VIEW_TYPE_TEMPLATES,
	VIEW_TYPE_EXERCISES,
	VIEW_TYPE_HISTORY,
	VIEW_TYPE_ACTIVE_WORKOUT,
} from '../../utils/constants';
import { usePlugin } from '../context';
import { ReactItemView } from './react-view';

function Home(): ReactElement {
	const plugin = usePlugin();
	const [hasActive, setHasActive] = useState(false);

	const refresh = useCallback(async () => {
		setHasActive(!!(await plugin.workouts.findActive()));
	}, [plugin]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return (
		<div className="gymmd-view gymmd-home">
			<h1 className="gymmd-home-title">GymMD</h1>
			<div className="gymmd-home-buttons">
				{hasActive && (
					<button
						className="mod-cta gymmd-home-button"
						onClick={() => void plugin.activateView(VIEW_TYPE_ACTIVE_WORKOUT)}
					>
						Resume active workout
					</button>
				)}
				<button
					className="gymmd-home-button"
					onClick={() => void plugin.activateView(VIEW_TYPE_TEMPLATES)}
				>
					Templates
				</button>
				<button
					className="gymmd-home-button"
					onClick={() => void plugin.activateView(VIEW_TYPE_EXERCISES)}
				>
					Exercises
				</button>
				<button
					className="gymmd-home-button"
					onClick={() => void plugin.activateView(VIEW_TYPE_HISTORY)}
				>
					History
				</button>
			</div>
		</div>
	);
}

export class HomeView extends ReactItemView {
	getViewType(): string {
		return VIEW_TYPE_HOME;
	}

	getDisplayText(): string {
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- "GymMD" is a brand name
		return 'GymMD';
	}

	getIcon(): string {
		return 'dumbbell';
	}

	protected renderContent(): ReactElement {
		return <Home />;
	}
}

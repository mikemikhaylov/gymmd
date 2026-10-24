import { type ReactElement, useCallback, useEffect, useState } from 'react';
import { usePlugin } from '../context';
import { useNav } from '../navigation';
import { useSettings } from '../hooks/use-settings';

export function Home(): ReactElement {
	const plugin = usePlugin();
	const nav = useNav();
	const { modules } = useSettings(plugin);
	const [hasActive, setHasActive] = useState(false);

	const refresh = useCallback(async () => {
		setHasActive(!!(await plugin.workouts.findActive()));
	}, [plugin]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const none = !modules.strength && !modules.journal && !modules.bodyWeight;

	return (
		<div className="gymmd-view gymmd-home">
			<div className="gymmd-home-buttons">
				{modules.strength && (
					<>
						{hasActive && (
							<button className="mod-cta gymmd-home-button" onClick={() => nav.navigate('active')}>
								Resume active workout
							</button>
						)}
						<button className="gymmd-home-button" onClick={() => nav.navigate('templates')}>
							Templates
						</button>
						<button className="gymmd-home-button" onClick={() => nav.navigate('exercises')}>
							Exercises
						</button>
						<button className="gymmd-home-button" onClick={() => nav.navigate('history')}>
							History
						</button>
						<button className="gymmd-home-button" onClick={() => nav.navigate('reports')}>
							Reports
						</button>
					</>
				)}
				{modules.journal && (
					<button className="gymmd-home-button" onClick={() => nav.navigate('journal')}>
						Journal
					</button>
				)}
				{modules.bodyWeight && (
					<button className="gymmd-home-button" onClick={() => nav.navigate('bodyweight')}>
						Body weight
					</button>
				)}
				{none && (
					<p className="gymmd-empty">
						All modules are disabled. Turn them on in Settings → Community plugins → GymMD.
					</p>
				)}
			</div>
		</div>
	);
}

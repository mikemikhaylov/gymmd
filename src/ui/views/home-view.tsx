import { type ReactElement, useCallback, useEffect, useState } from 'react';
import { usePlugin } from '../context';
import { useNav } from '../navigation';

export function Home(): ReactElement {
	const plugin = usePlugin();
	const nav = useNav();
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
			</div>
		</div>
	);
}

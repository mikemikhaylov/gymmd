import { type ReactElement, useState } from 'react';
import { VIEW_TYPE_APP } from '../../utils/constants';
import { NavContext, type NavApi, type Route } from '../navigation';
import { ReactItemView } from './react-view';
import { Home } from './home-view';
import { ExerciseList } from './exercise-list-view';
import { TemplateList } from './template-list-view';
import { History } from './history-view';
import { ActiveWorkout } from './active-workout-view';
import { Reports } from './reports-view';
import { BodyWeight } from './body-weight-view';
import { Journal } from './journal-view';
import { JournalItems } from './journal-items-view';

const TITLES: Record<Route, string> = {
	home: 'GymMD',
	templates: 'Templates',
	exercises: 'Exercises',
	history: 'History',
	active: 'Active workout',
	reports: 'Reports',
	bodyweight: 'Body weight',
	journal: 'Journal',
	'journal-items': 'Journal items',
};

function Screen({ route }: { route: Route }): ReactElement {
	switch (route) {
		case 'templates':
			return <TemplateList />;
		case 'exercises':
			return <ExerciseList />;
		case 'history':
			return <History />;
		case 'active':
			return <ActiveWorkout />;
		case 'reports':
			return <Reports />;
		case 'bodyweight':
			return <BodyWeight />;
		case 'journal':
			return <Journal />;
		case 'journal-items':
			return <JournalItems />;
		case 'home':
		default:
			return <Home />;
	}
}

function App({ initialRoute }: { initialRoute: Route | null }): ReactElement {
	const [stack, setStack] = useState<Route[]>(() =>
		initialRoute && initialRoute !== 'home' ? ['home', initialRoute] : ['home'],
	);
	const route = stack[stack.length - 1];
	const [actionsEl, setActionsEl] = useState<HTMLElement | null>(null);

	const nav: NavApi = {
		route,
		navigate: (r) => setStack((s) => [...s, r]),
		back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : ['home'])),
		home: () => setStack(['home']),
		canGoBack: route !== 'home',
		actionsEl,
	};

	return (
		<NavContext.Provider value={nav}>
			<div className="gymmd-app">
				{route !== 'home' && (
					<div className="gymmd-navbar">
						<button className="gymmd-back-button" aria-label="Back" onClick={nav.back}>
							‹
						</button>
						<span className="gymmd-navbar-title">{TITLES[route]}</span>
						<div className="gymmd-navbar-actions" ref={setActionsEl} />
					</div>
				)}
				<Screen route={route} />
			</div>
		</NavContext.Provider>
	);
}

export class GymMDView extends ReactItemView {
	getViewType(): string {
		return VIEW_TYPE_APP;
	}

	getDisplayText(): string {
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- "GymMD" is a brand name
		return 'GymMD';
	}

	getIcon(): string {
		return 'dumbbell';
	}

	protected renderContent(): ReactElement {
		const initialRoute = this.plugin.pendingRoute;
		this.plugin.pendingRoute = null;
		return <App initialRoute={initialRoute} />;
	}
}

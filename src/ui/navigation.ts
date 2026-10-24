import { createContext, useContext } from 'react';

export type Route =
	| 'home'
	| 'templates'
	| 'exercises'
	| 'history'
	| 'active'
	| 'reports'
	| 'bodyweight'
	| 'journal'
	| 'journal-items';

export interface NavApi {
	route: Route;
	navigate: (route: Route) => void;
	back: () => void;
	home: () => void;
	canGoBack: boolean;
	/** Right-hand slot of the navbar; screens portal their actions into it (see NavActions). */
	actionsEl: HTMLElement | null;
}

export const NavContext = createContext<NavApi | null>(null);

export function useNav(): NavApi {
	const nav = useContext(NavContext);
	if (!nav) throw new Error('NavContext is not available');
	return nav;
}

import { useCallback, useSyncExternalStore } from 'react';
import type GymMDPlugin from '../../main';
import type { GymMDSettings } from '../../settings';

/** Current plugin settings; re-renders when they're saved (e.g. a module toggled). */
export function useSettings(plugin: GymMDPlugin): GymMDSettings {
	const subscribe = useCallback((cb: () => void) => plugin.subscribeSettings(cb), [plugin]);
	return useSyncExternalStore(subscribe, () => plugin.settings);
}

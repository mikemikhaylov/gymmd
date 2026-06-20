import { createContext, useContext } from 'react';
import type GymMDPlugin from '../main';

export const PluginContext = createContext<GymMDPlugin | null>(null);

export function usePlugin(): GymMDPlugin {
	const plugin = useContext(PluginContext);
	if (!plugin) throw new Error('PluginContext is not available');
	return plugin;
}

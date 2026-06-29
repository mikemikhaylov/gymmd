import { useEffect } from 'react';

/**
 * Keeps the screen awake while `enabled` (Screen Wake Lock API). The lock is
 * released automatically when the document is hidden, so we re-acquire it on
 * visibility change. No-ops where the API is unsupported.
 */
export function useWakeLock(enabled: boolean): void {
	useEffect(() => {
		if (!enabled || !('wakeLock' in navigator)) return;

		let sentinel: WakeLockSentinel | null = null;
		let cancelled = false;

		const acquire = async () => {
			if (activeDocument.visibilityState !== 'visible') return;
			try {
				const lock = await navigator.wakeLock.request('screen');
				if (cancelled) {
					void lock.release();
					return;
				}
				sentinel = lock;
				lock.addEventListener('release', () => {
					sentinel = null;
				});
			} catch {
				/* unsupported or blocked — ignore */
			}
		};

		const onVisibility = () => {
			if (activeDocument.visibilityState === 'visible' && !sentinel) void acquire();
		};

		void acquire();
		activeDocument.addEventListener('visibilitychange', onVisibility);

		return () => {
			cancelled = true;
			activeDocument.removeEventListener('visibilitychange', onVisibility);
			void sentinel?.release();
			sentinel = null;
		};
	}, [enabled]);
}

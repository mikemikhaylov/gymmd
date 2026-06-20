import { useEffect, useState } from 'react';

/** Re-render on an interval while `active`, returning the current epoch ms. */
export function useNow(active: boolean, intervalMs = 1000): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		const id = window.setInterval(() => setNow(Date.now()), intervalMs);
		return () => window.clearInterval(id);
	}, [active, intervalMs]);
	return now;
}

import { useEffect, useState } from 'react';

/**
 * Returns how many pixels the on-screen keyboard currently overlaps the bottom
 * of the window (0 when closed), using the visualViewport API. Used to lift
 * bottom-pinned content above the mobile keyboard so focused inputs stay visible.
 */
export function useKeyboardInset(): number {
	const [inset, setInset] = useState(0);

	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) return;
		const update = () => {
			const overlap = window.innerHeight - vv.height - vv.offsetTop;
			setInset(overlap > 1 ? Math.round(overlap) : 0);
		};
		update();
		vv.addEventListener('resize', update);
		vv.addEventListener('scroll', update);
		return () => {
			vv.removeEventListener('resize', update);
			vv.removeEventListener('scroll', update);
		};
	}, []);

	return inset;
}

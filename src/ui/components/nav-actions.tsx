import type { ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNav } from '../navigation';

/**
 * Renders a screen's primary actions in the navbar next to its title, so a
 * screen needs no heading row of its own (saves vertical space on phones).
 */
export function NavActions({ children }: { children: ReactNode }): ReactElement | null {
	const { actionsEl } = useNav();
	return actionsEl ? createPortal(children, actionsEl) : null;
}

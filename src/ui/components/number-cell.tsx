import { type ReactElement } from 'react';
import { usePlugin } from '../context';
import { promptNumber } from '../modals/prompts';

/**
 * A tappable value that opens a validated number popup (instead of an inline
 * input). Used on mobile-critical screens where an inline keyboard would cover
 * the field — the popup is an Obsidian modal, which handles the keyboard well.
 */
interface Props {
	value: number | null;
	kind: 'reps' | 'weight';
	onChange: (value: number | null) => void;
	label?: string;
	className?: string;
}

export function NumberCell({ value, kind, onChange, label, className }: Props): ReactElement {
	const plugin = usePlugin();

	const display =
		value === null ? '—' : kind === 'weight' && value === 0 ? 'BW' : String(value);

	const onClick = async () => {
		const result = await promptNumber(plugin.app, {
			title: label ?? (kind === 'reps' ? 'Reps' : 'Weight (kg)'),
			kind,
			value,
		});
		if (result !== undefined) onChange(result);
	};

	return (
		<button
			className={className ? `gymmd-num-cell ${className}` : 'gymmd-num-cell'}
			onClick={() => void onClick()}
		>
			{display}
		</button>
	);
}

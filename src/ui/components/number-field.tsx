import { type ReactElement, useEffect, useState } from 'react';

/**
 * Validated numeric input.
 *  - kind="reps":   positive integer, 1–999 (no decimals).
 *  - kind="weight": ≥ 0, at most 2 decimal places (e.g. 1.75 ok, 1.757 not).
 *
 * Kept as a text input with its own draft string so partial values like "1."
 * can be typed; the numeric value is propagated as it becomes valid, and the
 * draft re-syncs from the prop whenever the field isn't focused.
 */
interface Props {
	value: number | null;
	onChange: (value: number | null) => void;
	kind: 'reps' | 'weight';
	className?: string;
}

// Keystroke-level filters (allow partial input while typing).
const ALLOWED: Record<Props['kind'], RegExp> = {
	reps: /^\d{0,3}$/,
	weight: /^\d{0,5}(\.\d{0,2})?$/,
};

const MAX_WEIGHT = 99999.99;

export function NumberField({ value, onChange, kind, className }: Props): ReactElement {
	const [text, setText] = useState(value === null ? '' : String(value));
	const [focused, setFocused] = useState(false);

	useEffect(() => {
		if (!focused) setText(value === null ? '' : String(value));
	}, [value, focused]);

	const commit = (raw: string) => {
		if (raw.trim() === '') {
			onChange(null);
			return;
		}
		const n = Number(raw);
		if (!Number.isFinite(n)) return;
		if (kind === 'reps') {
			onChange(Math.min(999, Math.max(1, Math.floor(n))));
		} else {
			onChange(Math.min(MAX_WEIGHT, Math.max(0, Math.round(n * 100) / 100)));
		}
	};

	const handleChange = (raw: string) => {
		if (raw !== '' && !ALLOWED[kind].test(raw)) return; // reject invalid keystroke
		setText(raw);
		commit(raw);
	};

	return (
		<input
			type="text"
			inputMode={kind === 'reps' ? 'numeric' : 'decimal'}
			enterKeyHint="done"
			className={className}
			value={text}
			onFocus={(e) => {
				setFocused(true);
				// After the keyboard opens, make sure the field is visible.
				const el = e.currentTarget;
				window.setTimeout(() => el.scrollIntoView({ block: 'nearest' }), 350);
			}}
			onBlur={() => {
				setFocused(false);
				commit(text);
			}}
			onKeyDown={(e) => {
				if (e.key === 'Enter') e.currentTarget.blur();
			}}
			onChange={(e) => handleChange(e.target.value)}
		/>
	);
}

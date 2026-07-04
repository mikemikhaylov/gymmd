import { type ReactElement, useState } from 'react';
import { NumberField } from '../components/number-field';

/** Edit a single body-weight measurement (weight + date/time) in a modal. */
interface Props {
	initial: { weight: number | null; at: string };
	title: string;
	onSave: (weight: number, at: string) => void;
	close: () => void;
}

/** ISO datetime "2026-07-04T08:30:00" -> datetime-local value "2026-07-04T08:30". */
function toLocal(at: string): string {
	return at.slice(0, 16);
}

export function BodyWeightEditor({ initial, title, onSave, close }: Props): ReactElement {
	const [weight, setWeight] = useState<number | null>(initial.weight);
	const [at, setAt] = useState<string>(toLocal(initial.at));

	const canSave = weight !== null && at.length >= 16;

	const save = () => {
		if (weight === null || at.length < 16) return;
		// The datetime-local picker is minute-precision. If the user didn't touch
		// it, keep the original full timestamp (with seconds) so entries added in
		// the same minute stay distinct and correctly ordered. Only when they
		// actually change the minute do we fall back to :00 seconds.
		const finalAt = at === toLocal(initial.at) ? initial.at : `${at}:00`;
		onSave(weight, finalAt);
		close();
	};

	return (
		<div className="gymmd-editor gymmd-bw-editor">
			<h3>{title}</h3>
			<label className="gymmd-bw-field">
				<span>Weight (kg)</span>
				<NumberField kind="weight" value={weight} onChange={setWeight} />
			</label>
			<label className="gymmd-bw-field">
				<span>Date &amp; time</span>
				<input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
			</label>
			<div className="gymmd-footer">
				<button className="mod-cta" disabled={!canSave} onClick={save}>
					Save
				</button>
				<button onClick={close}>Cancel</button>
			</div>
		</div>
	);
}

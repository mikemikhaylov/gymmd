import { type ReactElement, useState } from 'react';
import type { JournalField, JournalItem } from '../../types';
import { DOSAGE_UNITS, FIELD_LABELS, FIELD_ORDER, PRESETS, sortFields } from '../../services/journal';

/** Create or edit a journal item definition in a modal. */
interface Props {
	initial: JournalItem;
	isNew: boolean;
	onSave: (item: JournalItem) => void;
	/** Offered for existing custom items; built-ins can only be disabled. */
	onDelete?: () => void;
	close: () => void;
}

export function JournalItemEditor({ initial, isNew, onSave, onDelete, close }: Props): ReactElement {
	const [item, setItem] = useState<JournalItem>(() => structuredClone(initial));
	const update = (patch: Partial<JournalItem>) => setItem((prev) => ({ ...prev, ...patch }));

	const toggleField = (f: JournalField, on: boolean) =>
		setItem((prev) => ({
			...prev,
			fields: sortFields(on ? [...prev.fields, f] : prev.fields.filter((x) => x !== f)),
		}));

	const canSave = item.name.trim().length > 0;

	const save = () => {
		if (!canSave) return;
		onSave({ ...item, name: item.name.trim(), hint: item.hint.trim(), count_unit: item.count_unit.trim() });
		close();
	};

	return (
		<div className="gymmd-editor gymmd-bw-editor">
			<label className="gymmd-bw-field">
				<span>Name</span>
				<input
					type="text"
					autoFocus={isNew}
					placeholder="Headache, magnesium, alcohol…"
					value={item.name}
					onChange={(e) => update({ name: e.target.value })}
				/>
			</label>
			<label className="gymmd-bw-field">
				<span>Hint (optional)</span>
				<input
					type="text"
					placeholder="What to record, e.g. time of your last dose"
					value={item.hint}
					onChange={(e) => update({ hint: e.target.value })}
				/>
			</label>

			<div className="gymmd-bw-field">
				<span>Start from a preset</span>
				<div className="gymmd-journal-chips">
					{PRESETS.map((p) => (
						<button
							key={p.id}
							onClick={() =>
								update({
									fields: sortFields(p.fields),
									repeatable: p.repeatable,
									count_unit: p.count_unit ?? item.count_unit,
									dosage_unit: p.dosage_unit ?? item.dosage_unit,
								})
							}
						>
							{p.label}
						</button>
					))}
				</div>
			</div>

			<div className="gymmd-bw-field">
				<span>When answered “yes”, also ask for</span>
				<div className="gymmd-journal-fieldlist">
					{FIELD_ORDER.map((f) => (
						<label key={f} className="gymmd-checkbox">
							<input
								type="checkbox"
								checked={item.fields.includes(f)}
								onChange={(e) => toggleField(f, e.target.checked)}
							/>
							{f === 'count' ? 'Portions' : FIELD_LABELS[f]}
						</label>
					))}
				</div>
				{item.fields.length === 0 && <span className="gymmd-muted">Nothing — a plain yes / no.</span>}
			</div>

			<label className="gymmd-checkbox gymmd-journal-repeatable">
				<input
					type="checkbox"
					checked={item.repeatable}
					onChange={(e) => update({ repeatable: e.target.checked })}
				/>
				Can be logged multiple times per day
			</label>

			{item.fields.includes('count') && (
				<label className="gymmd-bw-field">
					<span>Portion unit</span>
					<input
						type="text"
						placeholder="cups, servings, glasses…"
						value={item.count_unit}
						onChange={(e) => update({ count_unit: e.target.value })}
					/>
				</label>
			)}
			{item.fields.includes('dosage') && (
				<label className="gymmd-bw-field">
					<span>Default dosage unit</span>
					<select
						className="dropdown"
						value={item.dosage_unit}
						onChange={(e) => update({ dosage_unit: e.target.value })}
					>
						{DOSAGE_UNITS.map((u) => (
							<option key={u} value={u}>
								{u}
							</option>
						))}
					</select>
				</label>
			)}

			{!isNew && (
				<p className="gymmd-muted">
					Changes apply to new answers; past days keep what was recorded.
				</p>
			)}

			<div className="gymmd-footer">
				<button className="mod-cta" disabled={!canSave} onClick={save}>
					Save
				</button>
				<button onClick={close}>Cancel</button>
				{onDelete && (
					<button
						className="mod-warning gymmd-footer-end"
						onClick={() => {
							close();
							onDelete();
						}}
					>
						Delete
					</button>
				)}
			</div>
		</div>
	);
}

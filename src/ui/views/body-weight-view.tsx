import { Notice } from 'obsidian';
import { type ReactElement, useCallback, useEffect, useState } from 'react';
import type { BodyWeightMeasurement } from '../../types';
import { bodyWeightId } from '../../utils/id';
import { nowISODateTime } from '../../utils/date';
import { usePlugin } from '../context';
import { confirm } from '../modals/prompts';
import { openReactModal } from '../modals/react-modal';
import { BodyWeightEditor } from '../modals/body-weight-editor';

function formatWhen(at: string): string {
	return `${at.slice(0, 10)} ${at.slice(11, 19)}`;
}

export function BodyWeight(): ReactElement {
	const plugin = usePlugin();
	const [measurements, setMeasurements] = useState<BodyWeightMeasurement[]>([]);
	const [baseline, setBaseline] = useState('');
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		const data = await plugin.bodyWeight.load();
		setMeasurements(data.measurements);
		setBaseline(data.content);
		setLoading(false);
	}, [plugin]);

	useEffect(() => {
		void load();
	}, [load]);

	const persist = async (next: BodyWeightMeasurement[]) => {
		const res = await plugin.bodyWeight.save(next, baseline);
		if (res.ok) {
			setMeasurements([...next].sort((a, b) => b.at.localeCompare(a.at)));
			setBaseline(res.content);
		} else {
			new Notice('Body weight file changed on disk — reloaded. Please redo your change.');
			setMeasurements(res.reloaded.measurements);
			setBaseline(res.reloaded.content);
		}
	};

	const openEditor = (
		title: string,
		initial: { weight: number | null; at: string },
		onSave: (weight: number, at: string) => void,
	) => {
		openReactModal(
			plugin,
			(close) => (
				<BodyWeightEditor title={title} initial={initial} onSave={onSave} close={close} />
			),
			{ title },
		);
	};

	const onAdd = () => {
		openEditor(
			'Add measurement',
			{ weight: measurements[0]?.weight ?? null, at: nowISODateTime() },
			(weight, at) => void persist([...measurements, { id: bodyWeightId(), weight, at }]),
		);
	};

	const onEdit = (m: BodyWeightMeasurement) => {
		openEditor('Edit measurement', { weight: m.weight, at: m.at }, (weight, at) => {
			void persist(measurements.map((x) => (x.id === m.id ? { ...x, weight, at } : x)));
		});
	};

	const onDelete = async (m: BodyWeightMeasurement) => {
		const ok = await confirm(plugin.app, {
			title: 'Delete measurement',
			message: `Delete the ${m.weight} kg entry from ${formatWhen(m.at)}?`,
			cta: 'Delete',
			danger: true,
		});
		if (!ok) return;
		await persist(measurements.filter((x) => x.id !== m.id));
	};

	return (
		<div className="gymmd-view">
			<div className="gymmd-header">
				<h2>Body weight</h2>
				<button className="mod-cta" onClick={onAdd}>
					Add
				</button>
			</div>

			{loading ? (
				<p>Loading…</p>
			) : measurements.length === 0 ? (
				<p className="gymmd-empty">No measurements yet — tap Add to log your weight.</p>
			) : (
				<ul className="gymmd-list">
					{measurements.map((m) => (
						<li key={m.id} className="gymmd-list-row">
							<span>
								<strong>{m.weight} kg</strong>
								<span className="gymmd-muted"> · {formatWhen(m.at)}</span>
							</span>
							<span className="gymmd-row-actions">
								<button onClick={() => onEdit(m)}>Edit</button>
								<button onClick={() => void onDelete(m)}>Delete</button>
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

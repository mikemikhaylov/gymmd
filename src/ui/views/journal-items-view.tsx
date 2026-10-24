import { Notice } from 'obsidian';
import { type ReactElement, useCallback, useEffect, useState } from 'react';
import type { JournalItem } from '../../types';
import { journalItemId } from '../../utils/id';
import { FIELD_LABELS } from '../../services/journal';
import { usePlugin } from '../context';
import { confirm } from '../modals/prompts';
import { openReactModal } from '../modals/react-modal';
import { JournalItemEditor } from '../modals/journal-item-editor';

function summarize(it: JournalItem): string {
	const fields = it.fields.length === 0 ? 'yes / no' : describeFields(it);
	return it.repeatable ? `${fields} · repeatable` : fields;
}

function describeFields(it: JournalItem): string {
	return it.fields
		.map((f) => {
			if (f === 'count') return it.count_unit || 'portions';
			if (f === 'dosage') return `dosage (${it.dosage_unit})`;
			return FIELD_LABELS[f].replace(/ \(.*\)$/, '').toLowerCase();
		})
		.join(', ');
}

export function JournalItems(): ReactElement {
	const plugin = usePlugin();
	const [items, setItems] = useState<JournalItem[]>([]);
	const [baseline, setBaseline] = useState('');
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		const data = await plugin.journal.loadItems();
		setItems(data.items);
		setBaseline(data.content);
		setLoading(false);
	}, [plugin]);

	useEffect(() => {
		void load();
	}, [load]);

	const persist = async (next: JournalItem[]) => {
		const res = await plugin.journal.saveItems(next, baseline);
		if (res.ok) {
			setItems(next.map((it, i) => ({ ...it, order: i + 1 })));
			setBaseline(res.content);
		} else {
			new Notice('Journal items file changed on disk — reloaded. Please redo your change.');
			setItems(res.reloaded.items);
			setBaseline(res.reloaded.content);
		}
	};

	const openEditor = (initial: JournalItem, isNew: boolean, onSave: (it: JournalItem) => void) => {
		const title = isNew ? 'New journal item' : `Edit ${initial.name}`;
		openReactModal(
			plugin,
			(close) => <JournalItemEditor initial={initial} isNew={isNew} onSave={onSave} close={close} />,
			{ title },
		);
	};

	const onAdd = () => {
		const blank: JournalItem = {
			item_id: journalItemId(),
			name: '',
			hint: '',
			builtin: false,
			enabled: true,
			repeatable: false,
			order: items.length + 1,
			fields: [],
			count_unit: '',
			dosage_unit: 'mg',
		};
		openEditor(blank, true, (it) => void persist([...items, it]));
	};

	const onEdit = (it: JournalItem) =>
		openEditor(it, false, (edited) =>
			void persist(items.map((x) => (x.item_id === it.item_id ? edited : x))),
		);

	const onToggle = (it: JournalItem) =>
		void persist(items.map((x) => (x.item_id === it.item_id ? { ...x, enabled: !x.enabled } : x)));

	const move = (index: number, delta: number) => {
		const j = index + delta;
		if (j < 0 || j >= items.length) return;
		const next = [...items];
		[next[index], next[j]] = [next[j], next[index]];
		void persist(next);
	};

	const onDelete = async (it: JournalItem) => {
		const ok = await confirm(plugin.app, {
			title: 'Delete journal item',
			message: `Delete "${it.name}"? Past journal days keep their answers (with name and units), but it won't be asked anymore. To just hide it, disable it instead.`,
			cta: 'Delete',
			danger: true,
		});
		if (!ok) return;
		await persist(items.filter((x) => x.item_id !== it.item_id));
	};

	return (
		<div className="gymmd-view">
			<div className="gymmd-header">
				<h2>Journal items</h2>
				<button className="mod-cta" onClick={onAdd}>
					Add item
				</button>
			</div>
			<p className="gymmd-muted">Only enabled items are shown in the journal.</p>

			{loading ? (
				<p>Loading…</p>
			) : items.length === 0 ? (
				<p className="gymmd-empty">No items — tap Add item to create one.</p>
			) : (
				<ul className="gymmd-list">
					{items.map((it, i) => (
						<li key={it.item_id} className="gymmd-list-row">
							<label className="gymmd-checkbox">
								<input type="checkbox" checked={it.enabled} onChange={() => onToggle(it)} />
								<span className={it.enabled ? '' : 'gymmd-muted'}>
									<strong>{it.name}</strong>
									<span className="gymmd-muted"> · {summarize(it)}</span>
								</span>
							</label>
							<span className="gymmd-row-actions">
								<button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
									↑
								</button>
								<button
									aria-label="Move down"
									disabled={i === items.length - 1}
									onClick={() => move(i, 1)}
								>
									↓
								</button>
								<button onClick={() => onEdit(it)}>Edit</button>
								{!it.builtin && <button onClick={() => void onDelete(it)}>Delete</button>}
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

import { type ReactElement, useCallback, useEffect, useState } from 'react';
import type { TemplateEntry } from '../../services/template-store';
import { usePlugin } from '../context';
import { useNav } from '../navigation';
import { promptText, confirm } from '../modals/prompts';
import { openReactModal } from '../modals/react-modal';
import { TemplateEditor } from '../modals/template-editor';

export function TemplateList(): ReactElement {
	const plugin = usePlugin();
	const nav = useNav();
	const [entries, setEntries] = useState<TemplateEntry[]>([]);

	const refresh = useCallback(async () => {
		setEntries(await plugin.templates.list());
	}, [plugin]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const openEditor = (entry: TemplateEntry) => {
		openReactModal(
			plugin,
			(close) => (
				<TemplateEditor
					file={entry.file}
					initial={entry.template}
					onSaved={() => void refresh()}
					close={close}
				/>
			),
			{ title: 'Edit template', wide: true },
		);
	};

	const onCreate = async () => {
		const name = await promptText(plugin.app, {
			title: 'New template',
			placeholder: 'Template name',
			cta: 'Create',
		});
		if (!name) return;
		const entry = await plugin.templates.create(name);
		await refresh();
		openEditor(entry);
	};

	const onDelete = async (entry: TemplateEntry) => {
		const ok = await confirm(plugin.app, {
			title: 'Delete template',
			message: `Delete "${entry.template.name}"? Past workouts are unaffected.`,
			cta: 'Delete',
			danger: true,
		});
		if (!ok) return;
		await plugin.templates.delete(entry.file);
		await refresh();
	};

	const onStart = async (entry: TemplateEntry) => {
		await plugin.startWorkout(entry);
		nav.navigate('active');
	};

	return (
		<div className="gymmd-view">
			<div className="gymmd-header">
				<h2>Templates</h2>
				<button className="mod-cta" onClick={() => void onCreate()}>
					New template
				</button>
			</div>

			{entries.length === 0 ? (
				<p className="gymmd-empty">No templates yet. Create one to start working out.</p>
			) : (
				<ul className="gymmd-list">
					{entries.map((entry) => {
						const exerciseCount = entry.template.exercises.length;
						const setCount = entry.template.exercises.reduce((n, ex) => n + ex.sets.length, 0);
						return (
						<li key={entry.template.template_id} className="gymmd-list-row">
							<span>
								{entry.template.name}
								<span className="gymmd-muted">
									{' '}
									· {exerciseCount} exercises · {setCount} sets
								</span>
							</span>
							<span className="gymmd-row-actions">
								<button className="mod-cta" onClick={() => void onStart(entry)}>
									Start
								</button>
								<button onClick={() => openEditor(entry)}>Edit</button>
								<button onClick={() => void onDelete(entry)}>Delete</button>
							</span>
						</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

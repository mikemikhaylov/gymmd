import { type ReactElement, useCallback, useEffect, useState } from 'react';
import { VIEW_TYPE_TEMPLATES } from '../../utils/constants';
import type { TemplateEntry } from '../../services/template-store';
import { usePlugin } from '../context';
import { promptText, confirm } from '../modals/prompts';
import { openReactModal } from '../modals/react-modal';
import { TemplateEditor } from '../modals/template-editor';
import { ReactItemView } from './react-view';

function TemplateList(): ReactElement {
	const plugin = usePlugin();
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
					{entries.map((entry) => (
						<li key={entry.template.template_id} className="gymmd-list-row">
							<span>
								{entry.template.name}
								<span className="gymmd-muted">
									{' '}
									· {entry.template.exercise_count} exercises ·{' '}
									{entry.template.total_planned_sets} sets
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
					))}
				</ul>
			)}
		</div>
	);
}

export class TemplateListView extends ReactItemView {
	getViewType(): string {
		return VIEW_TYPE_TEMPLATES;
	}

	getDisplayText(): string {
		return 'Workout templates';
	}

	getIcon(): string {
		return 'clipboard-list';
	}

	protected renderContent(): ReactElement {
		return <TemplateList />;
	}
}

import { Notice } from 'obsidian';
import { type ReactElement, useState } from 'react';
import type { TFile } from 'obsidian';
import type { Exercise, Template } from '../../types';
import { usePlugin } from '../context';
import { promptText } from './prompts';

interface Props {
	file: TFile;
	initial: Template;
	onSaved: () => void;
	close: () => void;
}

/** Inline search-or-create picker rendered within the editor (no extra modal). */
function ExercisePicker({
	available,
	query,
	setQuery,
	alreadyAdded,
	onPick,
	onCreate,
	onCancel,
}: {
	available: Exercise[];
	query: string;
	setQuery: (q: string) => void;
	alreadyAdded: string[];
	onPick: (e: Exercise) => void;
	onCreate: (name: string) => void;
	onCancel: () => void;
}): ReactElement {
	const q = query.trim().toLowerCase();
	const matches = available.filter((e) => e.name.toLowerCase().includes(q));
	const exactExists = available.some((e) => e.name.toLowerCase() === q);

	return (
		<div className="gymmd-picker">
			<input
				type="text"
				autoFocus
				placeholder="Search, or type a new exercise name…"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
			/>
			<div className="gymmd-picker-list">
				{matches.map((e) => {
					const added = alreadyAdded.includes(e.exercise_id);
					return (
						<button
							key={e.exercise_id}
							className="gymmd-picker-item"
							disabled={added}
							onClick={() => onPick(e)}
						>
							{e.name}
							{added ? ' (added)' : ''}
						</button>
					);
				})}
				{query.trim() && !exactExists && (
					<button className="gymmd-picker-item gymmd-picker-create" onClick={() => onCreate(query.trim())}>
						➕ Create "{query.trim()}"
					</button>
				)}
				{matches.length === 0 && !query.trim() && (
					<p className="gymmd-empty">No exercises yet — type a name to create one.</p>
				)}
			</div>
			<button onClick={onCancel}>Cancel</button>
		</div>
	);
}

export function TemplateEditor({ file, initial, onSaved, close }: Props): ReactElement {
	const plugin = usePlugin();
	const [template, setTemplate] = useState<Template>(() => structuredClone(initial));
	// Inline exercise picker state (null = closed). Kept in-component so there's
	// no second Obsidian modal stacked over this React modal.
	const [available, setAvailable] = useState<Exercise[] | null>(null);
	const [query, setQuery] = useState('');

	const update = (fn: (t: Template) => void) =>
		setTemplate((prev) => {
			const next = structuredClone(prev);
			fn(next);
			return next;
		});

	const openPicker = async () => {
		const list = await plugin.exercises.list(false);
		setQuery('');
		setAvailable(list.map((e) => e.exercise));
	};

	const addExerciseToTemplate = (exercise: Exercise) => {
		setAvailable(null);
		setQuery('');
		if (template.exercises.some((x) => x.exercise_id === exercise.exercise_id)) {
			new Notice(`${exercise.name} is already in this template`);
			return;
		}
		update((t) => {
			t.exercises.push({
				exercise_id: exercise.exercise_id,
				name: exercise.name,
				order: t.exercises.length + 1,
				sets: [{ set: 1, reps: 10, weight: 20 }],
			});
		});
	};

	const createAndAdd = async (name: string) => {
		const exercise = await plugin.exercises.create(name);
		addExerciseToTemplate(exercise);
	};

	const moveExercise = (index: number, delta: number) =>
		update((t) => {
			const j = index + delta;
			if (j < 0 || j >= t.exercises.length) return;
			[t.exercises[index], t.exercises[j]] = [t.exercises[j], t.exercises[index]];
		});

	const removeExercise = (index: number) =>
		update((t) => {
			t.exercises.splice(index, 1);
		});

	const addSet = (exIndex: number) =>
		update((t) => {
			const ex = t.exercises[exIndex];
			const last = ex.sets[ex.sets.length - 1];
			ex.sets.push({
				set: ex.sets.length + 1,
				reps: last ? last.reps : 10,
				weight: last ? last.weight : 20,
			});
		});

	const removeSet = (exIndex: number, setIndex: number) =>
		update((t) => {
			t.exercises[exIndex].sets.splice(setIndex, 1);
		});

	const moveSet = (exIndex: number, setIndex: number, delta: number) =>
		update((t) => {
			const sets = t.exercises[exIndex].sets;
			const j = setIndex + delta;
			if (j < 0 || j >= sets.length) return;
			[sets[setIndex], sets[j]] = [sets[j], sets[setIndex]];
		});

	const editSet = (exIndex: number, setIndex: number, field: 'reps' | 'weight', value: number) =>
		update((t) => {
			t.exercises[exIndex].sets[setIndex][field] = value;
		});

	const onRename = async () => {
		const name = await promptText(plugin.app, {
			title: 'Template name',
			value: template.name,
			cta: 'Rename',
		});
		if (name) update((t) => (t.name = name));
	};

	const onSave = async () => {
		if (template.name !== initial.name) {
			await plugin.templates.rename(file, template, template.name);
		} else {
			await plugin.templates.save(file, template);
		}
		new Notice('Template saved');
		onSaved();
		close();
	};

	return (
		<div className="gymmd-editor">
			<div className="gymmd-header">
				<h3>
					{template.name}{' '}
					<button className="gymmd-link" onClick={() => void onRename()}>
						rename
					</button>
				</h3>
				<button className="mod-cta" onClick={() => void openPicker()}>
					Add exercise
				</button>
			</div>

			{available !== null && (
				<ExercisePicker
					available={available}
					query={query}
					setQuery={setQuery}
					alreadyAdded={template.exercises.map((e) => e.exercise_id)}
					onPick={addExerciseToTemplate}
					onCreate={(name) => void createAndAdd(name)}
					onCancel={() => setAvailable(null)}
				/>
			)}

			{template.exercises.length === 0 && available === null && (
				<p className="gymmd-empty">No exercises. Add one to start building.</p>
			)}

			{template.exercises.map((ex, exIndex) => (
				<div key={ex.exercise_id} className="gymmd-exercise-block">
					<div className="gymmd-exercise-head">
						<strong>{ex.name}</strong>
						<span className="gymmd-row-actions">
							<button onClick={() => moveExercise(exIndex, -1)} disabled={exIndex === 0}>
								↑
							</button>
							<button
								onClick={() => moveExercise(exIndex, 1)}
								disabled={exIndex === template.exercises.length - 1}
							>
								↓
							</button>
							<button onClick={() => removeExercise(exIndex)}>Remove</button>
						</span>
					</div>

					<table className="gymmd-set-table">
						<thead>
							<tr>
								<th>Set</th>
								<th>Reps</th>
								<th>Weight (kg)</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{ex.sets.map((s, setIndex) => (
								<tr key={setIndex}>
									<td>{setIndex + 1}</td>
									<td>
										<input
											type="number"
											value={s.reps}
											min={0}
											onChange={(e) =>
												editSet(exIndex, setIndex, 'reps', Number(e.target.value))
											}
										/>
									</td>
									<td>
										<input
											type="number"
											value={s.weight}
											min={0}
											step="0.5"
											onChange={(e) =>
												editSet(exIndex, setIndex, 'weight', Number(e.target.value))
											}
										/>
									</td>
									<td className="gymmd-row-actions">
										<button onClick={() => moveSet(exIndex, setIndex, -1)} disabled={setIndex === 0}>
											↑
										</button>
										<button
											onClick={() => moveSet(exIndex, setIndex, 1)}
											disabled={setIndex === ex.sets.length - 1}
										>
											↓
										</button>
										<button onClick={() => removeSet(exIndex, setIndex)}>✕</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					<button onClick={() => addSet(exIndex)}>Add set</button>
				</div>
			))}

			<div className="gymmd-footer">
				<button className="mod-cta" onClick={() => void onSave()}>
					Save template
				</button>
				<button onClick={close}>Cancel</button>
			</div>
		</div>
	);
}

import type { TFile } from 'obsidian';
import type { Workout } from '../../types';
import { diffCompletedAgainstTemplate, applyCompletedToTemplate } from '../../services/diff';
import { chooseAction } from './prompts';
import type GymMDPlugin from '../../main';

/**
 * Finish flow (PLAN.md §7). Diffs completed sets against the source template;
 * prompts to update the template only when there's a difference. Returns the
 * moved (completed) file, or null if the user cancelled.
 */
export async function runFinishFlow(
	plugin: GymMDPlugin,
	file: TFile,
	workout: Workout,
): Promise<TFile | null> {
	const tplEntry = await plugin.templates.getById(workout.template_id);
	if (!tplEntry) {
		return plugin.workouts.finish(file, workout);
	}

	const diff = diffCompletedAgainstTemplate(workout, tplEntry.template);
	if (!diff.hasChanges) {
		return plugin.workouts.finish(file, workout);
	}

	const choice = await chooseAction(plugin.app, {
		title: 'Finish workout',
		message:
			'Your performance differs from the template:\n\n' +
			diff.changes.map((c) => `• ${c}`).join('\n'),
		actions: [
			{ id: 'update', label: 'Update template', cta: true },
			{ id: 'keep', label: 'Keep template as-is' },
			{ id: 'cancel', label: 'Cancel' },
		],
	});

	if (choice === null || choice === 'cancel') return null;

	if (choice === 'update') {
		const updated = applyCompletedToTemplate(workout, tplEntry.template);
		await plugin.templates.save(tplEntry.file, updated);
	}

	return plugin.workouts.finish(file, workout);
}

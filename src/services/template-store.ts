import { type App, TFile } from 'obsidian';
import type { Template } from '../types';
import { TYPE_TEMPLATE } from '../utils/constants';
import { templateId } from '../utils/id';
import { todayISODate } from '../utils/date';
import { resolvePaths, ensureFolders, uniquePath, sanitizeFileName } from './paths';
import { templateFromFrontmatter } from './parse';
import { serializeTemplate } from './serializer';
import { recomputeTemplateSummary } from './summary';
import { filesIn, readTyped, writeFile } from './vault-io';
import type { GymMDSettings } from '../settings';

export interface TemplateEntry {
	file: TFile;
	template: Template;
}

export class TemplateStore {
	constructor(
		private app: App,
		private getSettings: () => GymMDSettings,
	) {}

	private folder(): string {
		return resolvePaths(this.getSettings()).templates;
	}

	async list(): Promise<TemplateEntry[]> {
		const entries: TemplateEntry[] = [];
		for (const file of filesIn(this.app, this.folder())) {
			const template = await readTyped(this.app, file, templateFromFrontmatter);
			if (!template) continue;
			entries.push({ file, template });
		}
		return entries.sort((a, b) => a.template.name.localeCompare(b.template.name));
	}

	async getById(id: string): Promise<TemplateEntry | null> {
		for (const file of filesIn(this.app, this.folder())) {
			const template = await readTyped(this.app, file, templateFromFrontmatter);
			if (template && template.template_id === id) return { file, template };
		}
		return null;
	}

	async create(name: string): Promise<TemplateEntry> {
		const paths = resolvePaths(this.getSettings());
		await ensureFolders(this.app, paths);
		const today = todayISODate();
		const template: Template = {
			type: TYPE_TEMPLATE,
			template_id: templateId(),
			name: name.trim(),
			created: today,
			updated: today,
			exercise_count: 0,
			total_planned_sets: 0,
			exercises: [],
		};
		const path = uniquePath(this.app, paths.templates, template.name);
		const file = await this.app.vault.create(path, serializeTemplate(template));
		return { file, template };
	}

	/** Persist a template, recomputing summary fields and `updated`. */
	async save(file: TFile, template: Template, touchUpdated = true): Promise<void> {
		if (touchUpdated) template.updated = todayISODate();
		recomputeTemplateSummary(template);
		await writeFile(this.app, file, serializeTemplate(template));
	}

	async rename(file: TFile, template: Template, newName: string): Promise<void> {
		template.name = newName.trim();
		await this.save(file, template);
		const safe = sanitizeFileName(template.name);
		if (file.basename !== safe) {
			const target = uniquePath(this.app, this.folder(), template.name);
			await this.app.fileManager.renameFile(file, target);
		}
	}

	async delete(file: TFile): Promise<void> {
		await this.app.fileManager.trashFile(file);
	}
}

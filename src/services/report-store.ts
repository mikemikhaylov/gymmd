import { type App, TFile } from 'obsidian';
import { todayISODate } from '../utils/date';
import { resolvePaths, ensureFolders, uniquePath } from './paths';
import type { GymMDSettings } from '../settings';

export class ReportStore {
	constructor(
		private app: App,
		private getSettings: () => GymMDSettings,
	) {}

	/** Write a report markdown file into the reports folder and return it. */
	async write(markdown: string): Promise<TFile> {
		const paths = resolvePaths(this.getSettings());
		await ensureFolders(this.app, paths);
		const path = uniquePath(this.app, paths.reports, `${todayISODate()} Report`);
		return this.app.vault.create(path, markdown);
	}
}

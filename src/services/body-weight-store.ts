import type { App } from 'obsidian';
import type { BodyWeightMeasurement } from '../types';
import { TYPE_BODY_WEIGHT_LOG } from '../utils/constants';
import { bodyWeightId } from '../utils/id';
import { resolvePaths, ensureFolder } from './paths';
import { readFrontmatter } from './serializer';
import { getFile } from './vault-io';
import type { GymMDSettings } from '../settings';

export interface BodyWeightData {
	measurements: BodyWeightMeasurement[]; // newest first
	content: string; // raw file content (baseline for conflict detection)
}

export type SaveResult =
	| { ok: true; content: string }
	| { ok: false; reloaded: BodyWeightData };

function sortDesc(ms: BodyWeightMeasurement[]): BodyWeightMeasurement[] {
	return [...ms].sort((a, b) => b.at.localeCompare(a.at));
}

/** data -> markdown (frontmatter is source of truth; table is a readable view). */
export function serializeBodyWeight(measurements: BodyWeightMeasurement[]): string {
	const sorted = sortDesc(measurements);
	const fm: string[] = ['---', `type: ${TYPE_BODY_WEIGHT_LOG}`, 'measurements:'];
	for (const m of sorted) {
		fm.push(`  - id: ${m.id}`);
		fm.push(`    weight: ${m.weight}`);
		fm.push(`    at: ${JSON.stringify(m.at)}`);
	}
	fm.push('---', '');

	const body: string[] = ['# Body weight', '', '| Date | Time | Weight (kg) |', '|---|---|---|'];
	for (const m of sorted) {
		body.push(`| ${m.at.slice(0, 10)} | ${m.at.slice(11, 19)} | ${m.weight} |`);
	}
	return `${fm.join('\n')}\n${body.join('\n')}\n`;
}

function parseBodyWeight(content: string): BodyWeightMeasurement[] {
	const fm = readFrontmatter(content);
	const arr = fm && Array.isArray(fm.measurements) ? (fm.measurements as Record<string, unknown>[]) : [];
	const out: BodyWeightMeasurement[] = [];
	for (const m of arr) {
		let at = '';
		if (m.at instanceof Date) at = m.at.toISOString().slice(0, 19);
		else if (typeof m.at === 'string') at = m.at;
		if (!at) continue;

		const weight =
			typeof m.weight === 'number'
				? m.weight
				: typeof m.weight === 'string'
					? Number(m.weight)
					: NaN;
		out.push({
			id: typeof m.id === 'string' && m.id ? m.id : bodyWeightId(),
			weight: Number.isFinite(weight) ? weight : 0,
			at,
		});
	}
	return sortDesc(out);
}

export class BodyWeightStore {
	constructor(
		private app: App,
		private getSettings: () => GymMDSettings,
	) {}

	private path(): string {
		return resolvePaths(this.getSettings()).bodyWeightFile;
	}

	private parentDir(path: string): string {
		const i = path.lastIndexOf('/');
		return i > 0 ? path.slice(0, i) : '';
	}

	/** Load (creating an empty log file if it doesn't exist yet). */
	async load(): Promise<BodyWeightData> {
		const path = this.path();
		const existing = getFile(this.app, path);
		if (!existing) {
			await ensureFolder(this.app, this.parentDir(path));
			const content = serializeBodyWeight([]);
			await this.app.vault.create(path, content);
			return { measurements: [], content };
		}
		const content = await this.app.vault.read(existing);
		return { measurements: parseBodyWeight(content), content };
	}

	/**
	 * Save, but first verify the file on disk still matches `expectedContent`
	 * (what the caller last loaded/wrote). If it changed underneath us, return
	 * the reloaded data instead of overwriting.
	 */
	async save(measurements: BodyWeightMeasurement[], expectedContent: string): Promise<SaveResult> {
		const path = this.path();
		const file = getFile(this.app, path);
		if (!file) {
			await ensureFolder(this.app, this.parentDir(path));
			const content = serializeBodyWeight(measurements);
			await this.app.vault.create(path, content);
			return { ok: true, content };
		}
		const current = await this.app.vault.read(file);
		if (current !== expectedContent) {
			return { ok: false, reloaded: { measurements: parseBodyWeight(current), content: current } };
		}
		const content = serializeBodyWeight(measurements);
		await this.app.vault.process(file, () => content);
		return { ok: true, content };
	}
}

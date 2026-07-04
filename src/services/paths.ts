import { type App, normalizePath } from 'obsidian';
import type { GymMDSettings } from '../settings';

// Fixed structure under the configurable root (not user-configurable).
const WORKOUTS_DIR = 'workouts';
const EXERCISES_DIR = 'exercises';
const TEMPLATES_DIR = 'templates';
const ACTIVE_DIR = 'active';
const COMPLETED_DIR = 'completed';
const REPORTS_DIR = 'reports';
const BODY_WEIGHT_FILE = 'body_weight.md';

export interface GymMDPaths {
	base: string;
	exercises: string;
	templates: string;
	active: string;
	completed: string;
	reports: string;
	bodyWeightFile: string;
}

function join(...parts: string[]): string {
	return normalizePath(parts.filter((p) => p && p.trim()).join('/'));
}

export function resolvePaths(s: GymMDSettings): GymMDPaths {
	const root = s.rootPath.trim();
	const base = join(root, WORKOUTS_DIR);
	return {
		base,
		exercises: join(base, EXERCISES_DIR),
		templates: join(base, TEMPLATES_DIR),
		active: join(base, ACTIVE_DIR),
		completed: join(base, COMPLETED_DIR),
		reports: join(base, REPORTS_DIR),
		bodyWeightFile: join(root, BODY_WEIGHT_FILE),
	};
}

/** Create a folder and any missing ancestors. */
export async function ensureFolder(app: App, path: string): Promise<void> {
	if (!path || path === '/') return;
	const parts = path.split('/');
	let cur = '';
	for (const part of parts) {
		cur = cur ? `${cur}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(cur)) {
			try {
				await app.vault.createFolder(cur);
			} catch {
				/* already exists (race) — ignore */
			}
		}
	}
}

/** Create all GymMD data folders that don't yet exist. */
export async function ensureFolders(app: App, paths: GymMDPaths): Promise<void> {
	for (const path of [paths.exercises, paths.templates, paths.active, paths.completed, paths.reports]) {
		await ensureFolder(app, path);
	}
}

/** Strip characters that are illegal in Obsidian/OS file names. */
export function sanitizeFileName(name: string): string {
	return name.replace(/[\\/:*?"<>|#^[\]]/g, '').trim() || 'Untitled';
}

/**
 * Build a unique path inside `folder` for `baseName`, appending -2, -3, … if a
 * file with that name already exists.
 */
export function uniquePath(app: App, folder: string, baseName: string): string {
	const safe = sanitizeFileName(baseName);
	let candidate = normalizePath(`${folder}/${safe}.md`);
	if (!app.vault.getAbstractFileByPath(candidate)) return candidate;
	for (let i = 2; ; i++) {
		candidate = normalizePath(`${folder}/${safe}-${i}.md`);
		if (!app.vault.getAbstractFileByPath(candidate)) return candidate;
	}
}

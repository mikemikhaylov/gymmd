import { type App, normalizePath } from 'obsidian';
import type { GymMDSettings } from '../settings';

export interface GymMDPaths {
	base: string;
	exercises: string;
	templates: string;
	active: string;
	completed: string;
	reports: string;
}

export function resolvePaths(s: GymMDSettings): GymMDPaths {
	const base = normalizePath(s.basePath);
	const join = (sub: string) => normalizePath(`${base}/${sub}`);
	return {
		base,
		exercises: join(s.exercisesFolder),
		templates: join(s.templatesFolder),
		active: join(s.activeFolder),
		completed: join(s.completedFolder),
		reports: join(s.reportsFolder),
	};
}

/** Create any of the GymMD folders that don't yet exist. */
export async function ensureFolders(app: App, paths: GymMDPaths): Promise<void> {
	const ordered = [
		paths.base,
		paths.exercises,
		paths.templates,
		paths.active,
		paths.completed,
		paths.reports,
	];
	for (const path of ordered) {
		if (!app.vault.getAbstractFileByPath(path)) {
			await app.vault.createFolder(path);
		}
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

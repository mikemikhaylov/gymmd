import { type App, TFile } from 'obsidian';
import { readFrontmatter } from './serializer';

/** Markdown files directly relevant under a folder (recursive by prefix). */
export function filesIn(app: App, folder: string): TFile[] {
	const prefix = `${folder}/`;
	return app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(prefix));
}

/** Read a file and map its frontmatter into a typed object, or null. */
export async function readTyped<T>(
	app: App,
	file: TFile,
	map: (fm: Record<string, unknown>, content: string) => T | null,
): Promise<T | null> {
	const content = await app.vault.read(file);
	const fm = readFrontmatter(content);
	if (!fm) return null;
	return map(fm, content);
}

/** Overwrite a file's contents with freshly serialized output. */
export async function writeFile(app: App, file: TFile, content: string): Promise<void> {
	await app.vault.process(file, () => content);
}

export function getFile(app: App, path: string): TFile | null {
	const f = app.vault.getAbstractFileByPath(path);
	return f instanceof TFile ? f : null;
}

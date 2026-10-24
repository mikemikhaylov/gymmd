import { type App, normalizePath } from 'obsidian';
import type { ISODate, JournalDay, JournalItem } from '../types';
import { builtinItems } from './journal';
import { ensureFolder, resolvePaths } from './paths';
import { journalDayFromFrontmatter, journalItemsFromFrontmatter } from './parse';
import { readFrontmatter, serializeJournalDay, serializeJournalItems } from './serializer';
import { filesIn, getFile } from './vault-io';
import type { GymMDSettings } from '../settings';

export interface JournalItemsData {
	items: JournalItem[];
	content: string; // raw file content (baseline for conflict detection)
}

export interface JournalDayData {
	day: JournalDay | null;
	/** Raw file content, or null if no file exists for that day yet. */
	content: string | null;
}

export type SaveResult<T> = { ok: true; content: string } | { ok: false; reloaded: T };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parentDir(path: string): string {
	const i = path.lastIndexOf('/');
	return i > 0 ? path.slice(0, i) : '';
}

function parseItems(content: string): JournalItem[] {
	const fm = readFrontmatter(content);
	return (fm && journalItemsFromFrontmatter(fm)) ?? [];
}

function parseDay(content: string): JournalDay | null {
	const fm = readFrontmatter(content);
	return fm ? journalDayFromFrontmatter(fm) : null;
}

/**
 * Journal persistence: one `items.md` with the question definitions and one
 * file per day under `journal/days/`. Every write is conflict-checked like the
 * body-weight log — if the file changed since it was loaded (edited elsewhere,
 * synced), the write is aborted and the fresh data returned instead.
 */
export class JournalStore {
	constructor(
		private app: App,
		private getSettings: () => GymMDSettings,
	) {}

	private itemsPath(): string {
		return resolvePaths(this.getSettings()).journalItemsFile;
	}

	private daysFolder(): string {
		return resolvePaths(this.getSettings()).journalDays;
	}

	private dayPath(date: ISODate): string {
		return normalizePath(`${this.daysFolder()}/${date}.md`);
	}

	/** Write `content` to `path` only if the file still matches `expected` (null = must not exist). */
	private async checkedWrite(
		path: string,
		content: string,
		expected: string | null,
	): Promise<{ ok: true } | { ok: false; current: string | null }> {
		const file = getFile(this.app, path);
		if (!file) {
			if (expected !== null) return { ok: false, current: null };
			await ensureFolder(this.app, parentDir(path));
			await this.app.vault.create(path, content);
			return { ok: true };
		}
		const current = await this.app.vault.read(file);
		if (current !== expected) return { ok: false, current };
		await this.app.vault.process(file, () => content);
		return { ok: true };
	}

	/** Load item definitions, seeding the built-ins if the file doesn't exist yet. */
	async loadItems(): Promise<JournalItemsData> {
		const path = this.itemsPath();
		const existing = getFile(this.app, path);
		if (!existing) {
			const items = builtinItems();
			const content = serializeJournalItems(items);
			await ensureFolder(this.app, parentDir(path));
			await this.app.vault.create(path, content);
			return { items, content };
		}
		const content = await this.app.vault.read(existing);
		const items = parseItems(content);
		// Built-ins shipped after this file was created are appended once. They
		// can't be deleted in the UI, so a missing one is new, not removed.
		const known = new Set(items.map((it) => it.item_id));
		const missing = builtinItems().filter((it) => !known.has(it.item_id));
		if (missing.length === 0) return { items, content };
		const res = await this.saveItems([...items, ...missing], content);
		return res.ok ? { items: parseItems(res.content), content: res.content } : res.reloaded;
	}

	async saveItems(
		items: JournalItem[],
		expected: string,
	): Promise<SaveResult<JournalItemsData>> {
		const normalized = items.map((it, i) => ({ ...it, order: i + 1 }));
		const content = serializeJournalItems(normalized);
		const res = await this.checkedWrite(this.itemsPath(), content, expected);
		if (res.ok) return { ok: true, content };
		const current = res.current ?? '';
		return { ok: false, reloaded: { items: parseItems(current), content: current } };
	}

	async loadDay(date: ISODate): Promise<JournalDayData> {
		const file = getFile(this.app, this.dayPath(date));
		if (!file) return { day: null, content: null };
		const content = await this.app.vault.read(file);
		const day = parseDay(content);
		// The file name is plugin-managed, so it is authoritative for the date.
		return { day: day && { ...day, date }, content };
	}

	async saveDay(day: JournalDay, expected: string | null): Promise<SaveResult<JournalDayData>> {
		const path = this.dayPath(day.date);
		const content = serializeJournalDay(day);
		const res = await this.checkedWrite(path, content, expected);
		if (res.ok) return { ok: true, content };
		return {
			ok: false,
			reloaded: { day: res.current === null ? null : parseDay(res.current), content: res.current },
		};
	}

	/** Dates (YYYY-MM-DD) that have a journal file, oldest first. */
	listDates(): ISODate[] {
		return filesIn(this.app, this.daysFolder())
			.map((f) => f.basename)
			.filter((b) => DATE_RE.test(b))
			.sort();
	}

	/** The most recent journal day strictly before `date` that has any answers. */
	async findPrevious(date: ISODate): Promise<JournalDay | null> {
		const earlier = this.listDates().filter((d) => d < date);
		for (let i = earlier.length - 1; i >= 0; i--) {
			const { day } = await this.loadDay(earlier[i]);
			if (day && day.entries.length) return day;
		}
		return null;
	}
}

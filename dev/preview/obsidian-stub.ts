/**
 * Minimal stand-in for the `obsidian` module, enough to run GymMD in a plain
 * browser for UI previews. It mirrors Obsidian's real DOM structure (modal,
 * setting, view shell) so Obsidian's own app.css styles it the same way.
 * Only the API surface GymMD uses is implemented.
 */
import yaml from 'js-yaml';

// --- HTMLElement helpers Obsidian adds to the prototype -------------------

interface DomInfo {
	text?: string;
	cls?: string | string[];
	attr?: Record<string, string>;
}

declare global {
	interface HTMLElement {
		setText(text: string): void;
		addClass(...cls: string[]): void;
		removeClass(...cls: string[]): void;
		toggleClass(cls: string, on: boolean): void;
		empty(): void;
		setAttr(name: string, value: string): void;
		createEl<K extends keyof HTMLElementTagNameMap>(tag: K, info?: DomInfo | string): HTMLElementTagNameMap[K];
		createDiv(info?: DomInfo | string): HTMLDivElement;
	}
}

const proto = HTMLElement.prototype;
proto.setText = function (text: string) {
	this.textContent = text;
};
proto.addClass = function (...cls: string[]) {
	this.classList.add(...cls.flatMap((c) => c.split(' ')).filter(Boolean));
};
proto.removeClass = function (...cls: string[]) {
	this.classList.remove(...cls);
};
proto.toggleClass = function (cls: string, on: boolean) {
	this.classList.toggle(cls, on);
};
proto.empty = function () {
	while (this.firstChild) this.removeChild(this.firstChild);
};
proto.setAttr = function (name: string, value: string) {
	this.setAttribute(name, value);
};
proto.createEl = function (tag, info) {
	const el = document.createElement(tag);
	const o: DomInfo = typeof info === 'string' ? { cls: info } : (info ?? {});
	if (o.text) el.textContent = o.text;
	if (o.cls) el.addClass(...(Array.isArray(o.cls) ? o.cls : [o.cls]));
	for (const [k, v] of Object.entries(o.attr ?? {})) el.setAttribute(k, v);
	this.appendChild(el);
	return el;
};
proto.createDiv = function (info) {
	return this.createEl('div', info);
};

// Globals Obsidian defines for multi-window support.
Object.assign(window, { activeDocument: document, activeWindow: window });

// --- Utilities ------------------------------------------------------------

export function normalizePath(p: string): string {
	return p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '') || '/';
}

export function parseYaml(s: string): unknown {
	return yaml.load(s);
}

export class Notice {
	constructor(message: string, timeout = 4000) {
		let container = document.body.querySelector<HTMLElement>('.notice-container');
		if (!container) container = document.body.createDiv('notice-container');
		const el = container.createDiv({ cls: 'notice', text: message });
		window.setTimeout(() => el.remove(), timeout);
	}
}

// --- Vault ----------------------------------------------------------------

export class TAbstractFile {
	constructor(public path: string) {}
	get name(): string {
		return this.path.split('/').pop() ?? this.path;
	}
}

export class TFolder extends TAbstractFile {}

export class TFile extends TAbstractFile {
	stat = { ctime: Date.now(), mtime: Date.now(), size: 0 };
	get basename(): string {
		return this.name.replace(/\.md$/, '');
	}
	get extension(): string {
		return this.name.split('.').pop() ?? '';
	}
}

export class Vault {
	files = new Map<string, { file: TFile; content: string }>();
	folders = new Map<string, TFolder>();

	getAbstractFileByPath(path: string): TAbstractFile | null {
		return this.files.get(path)?.file ?? this.folders.get(path) ?? null;
	}
	getMarkdownFiles(): TFile[] {
		return [...this.files.values()].map((f) => f.file).filter((f) => f.extension === 'md');
	}
	async create(path: string, content: string): Promise<TFile> {
		if (this.files.has(path)) throw new Error(`File already exists: ${path}`);
		const file = new TFile(path);
		this.files.set(path, { file, content });
		return file;
	}
	async createFolder(path: string): Promise<void> {
		this.folders.set(path, new TFolder(path));
	}
	async read(file: TFile): Promise<string> {
		return this.files.get(file.path)?.content ?? '';
	}
	async process(file: TFile, fn: (data: string) => string): Promise<string> {
		const entry = this.files.get(file.path);
		if (!entry) throw new Error(`No file: ${file.path}`);
		entry.content = fn(entry.content);
		entry.file.stat.mtime = Date.now();
		return entry.content;
	}
}

export class FileManager {
	constructor(private vault: Vault) {}
	async renameFile(file: TFile, newPath: string): Promise<void> {
		const entry = this.vault.files.get(file.path);
		if (!entry) return;
		this.vault.files.delete(file.path);
		file.path = newPath;
		this.vault.files.set(newPath, entry);
	}
	async trashFile(file: TFile): Promise<void> {
		this.vault.files.delete(file.path);
	}
}

// --- Components / plugin --------------------------------------------------

export class Component {
	private cleanups: (() => void)[] = [];
	register(cb: () => void): void {
		this.cleanups.push(cb);
	}
	registerEvent(): void {}
	registerDomEvent(el: EventTarget, type: string, cb: EventListener): void {
		el.addEventListener(type, cb);
		this.register(() => el.removeEventListener(type, cb));
	}
	registerInterval(id: number): number {
		this.register(() => window.clearInterval(id));
		return id;
	}
	unload(): void {
		this.cleanups.forEach((c) => c());
		this.cleanups = [];
	}
}

type ViewFactory = (leaf: WorkspaceLeaf) => ItemView;

export class WorkspaceLeaf {
	view: ItemView | null = null;
	constructor(
		public app: App,
		public containerEl: HTMLElement,
	) {}

	async setViewState(state: { type: string; active?: boolean }): Promise<void> {
		await this.detach();
		const factory = this.app.workspace.factories.get(state.type);
		if (!factory) throw new Error(`No view registered: ${state.type}`);
		this.containerEl.empty();
		this.containerEl.setAttr('data-type', state.type);
		const view = factory(this);
		this.view = view;
		renderViewHeader(this.containerEl, view.getDisplayText());
		this.containerEl.appendChild(view.contentEl);
		await view.onOpen();
	}

	/** Show a file the way the markdown view would (read-only preview). */
	async openFile(file: TFile): Promise<void> {
		await this.detach();
		this.containerEl.empty();
		this.containerEl.setAttr('data-type', 'markdown');
		renderViewHeader(this.containerEl, file.basename);
		const content = this.containerEl.createDiv('view-content');
		content.createEl('pre', { text: await this.app.vault.read(file), cls: 'gymmd-preview-file' });
	}

	async detach(): Promise<void> {
		if (this.view) {
			await this.view.onClose();
			this.view.unload();
			this.view = null;
		}
	}
}

/** The mobile view header Obsidian draws above every view. */
function renderViewHeader(containerEl: HTMLElement, title: string): void {
	const header = containerEl.createDiv('view-header');
	const left = header.createDiv('view-header-left');
	const nav = left.createDiv('view-header-nav-buttons');
	nav.createEl('button', { cls: 'clickable-icon', text: '‹', attr: { 'aria-label': 'Navigate back' } });
	const titleWrap = header.createDiv('view-header-title-container mod-at-start');
	titleWrap.createDiv({ cls: 'view-header-title', text: title });
	const actions = header.createDiv('view-actions');
	actions.createEl('button', { cls: 'clickable-icon view-action', text: '⋮' });
}

export class Workspace {
	factories = new Map<string, ViewFactory>();
	leaf: WorkspaceLeaf;
	constructor(app: App, leafContentEl: HTMLElement) {
		this.leaf = new WorkspaceLeaf(app, leafContentEl);
	}
	getLeavesOfType(type: string): WorkspaceLeaf[] {
		return this.leaf.containerEl.getAttribute('data-type') === type && this.leaf.view ? [this.leaf] : [];
	}
	getLeaf(): WorkspaceLeaf {
		return this.leaf; // phones have a single main pane
	}
	async revealLeaf(): Promise<void> {}
	detachLeavesOfType(type: string): void {
		for (const leaf of this.getLeavesOfType(type)) {
			void leaf.detach();
			leaf.containerEl.removeAttribute('data-type');
		}
	}
}

export class App {
	vault = new Vault();
	fileManager = new FileManager(this.vault);
	workspace: Workspace;
	constructor(leafContentEl: HTMLElement) {
		this.workspace = new Workspace(this, leafContentEl);
	}
}

export interface Command {
	id: string;
	name: string;
	callback?: () => void;
}

export class Plugin extends Component {
	commands: Command[] = [];
	ribbon: { icon: string; title: string; cb: () => void }[] = [];
	constructor(
		public app: App,
		public manifest: { id: string; version: string },
	) {
		super();
	}
	async loadData(): Promise<unknown> {
		return null;
	}
	async saveData(): Promise<void> {}
	registerView(type: string, factory: ViewFactory): void {
		this.app.workspace.factories.set(type, factory);
	}
	addRibbonIcon(icon: string, title: string, cb: () => void): HTMLElement {
		this.ribbon.push({ icon, title, cb });
		return document.createElement('div');
	}
	addCommand(cmd: Command): Command {
		this.commands.push(cmd);
		return cmd;
	}
	addSettingTab(): void {}
}

export abstract class ItemView extends Component {
	app: App;
	containerEl: HTMLElement;
	contentEl: HTMLElement;
	constructor(public leaf: WorkspaceLeaf) {
		super();
		this.app = leaf.app;
		this.containerEl = leaf.containerEl;
		this.contentEl = document.createElement('div');
		this.contentEl.addClass('view-content');
	}
	abstract getViewType(): string;
	abstract getDisplayText(): string;
	getIcon(): string {
		return '';
	}
	async onOpen(): Promise<void> {}
	async onClose(): Promise<void> {}
}

export class PluginSettingTab {
	containerEl = Object.assign(document.createElement('div'), { className: 'vertical-tab-content' });
	constructor(
		public app: App,
		public plugin: Plugin,
	) {}
	display(): void {}
}

// --- Modal ----------------------------------------------------------------

export class Modal {
	containerEl: HTMLElement;
	modalEl: HTMLElement;
	titleEl: HTMLElement;
	contentEl: HTMLElement;
	private onKey = (e: KeyboardEvent) => {
		if (e.key === 'Escape') this.close();
	};

	constructor(public app: App) {
		this.containerEl = document.createElement('div');
		this.containerEl.addClass('modal-container', 'mod-dim');
		const bg = this.containerEl.createDiv('modal-bg');
		bg.style.opacity = '0.85';
		bg.addEventListener('click', () => this.close());
		this.modalEl = this.containerEl.createDiv('modal');
		const closeBtn = this.modalEl.createDiv('modal-close-button');
		closeBtn.addEventListener('click', () => this.close());
		const header = this.modalEl.createDiv('modal-header');
		this.titleEl = header.createDiv('modal-title');
		this.contentEl = this.modalEl.createDiv('modal-content');
	}

	open(): void {
		document.body.appendChild(this.containerEl);
		document.addEventListener('keydown', this.onKey);
		this.onOpen();
	}

	close(): void {
		if (!this.containerEl.isConnected) return;
		document.removeEventListener('keydown', this.onKey);
		this.onClose();
		this.containerEl.remove();
	}

	onOpen(): void {}
	onClose(): void {}
}

// --- Setting --------------------------------------------------------------

export class TextComponent {
	inputEl: HTMLInputElement;
	private cb: ((v: string) => void) | null = null;
	constructor(containerEl: HTMLElement) {
		this.inputEl = containerEl.createEl('input', { attr: { type: 'text', spellcheck: 'false' } });
		this.inputEl.addEventListener('input', () => this.cb?.(this.inputEl.value));
	}
	setPlaceholder(p: string): this {
		this.inputEl.placeholder = p;
		return this;
	}
	setValue(v: string): this {
		this.inputEl.value = v;
		return this;
	}
	getValue(): string {
		return this.inputEl.value;
	}
	onChange(cb: (v: string) => void): this {
		this.cb = cb;
		return this;
	}
}

export class ButtonComponent {
	buttonEl: HTMLButtonElement;
	constructor(containerEl: HTMLElement) {
		this.buttonEl = containerEl.createEl('button');
	}
	setButtonText(t: string): this {
		this.buttonEl.setText(t);
		return this;
	}
	setCta(): this {
		this.buttonEl.addClass('mod-cta');
		return this;
	}
	setWarning(): this {
		this.buttonEl.addClass('mod-warning');
		return this;
	}
	setDestructive(): this {
		this.buttonEl.addClass('mod-destructive');
		return this;
	}
	setDisabled(d: boolean): this {
		this.buttonEl.disabled = d;
		return this;
	}
	onClick(cb: (e: MouseEvent) => void): this {
		this.buttonEl.addEventListener('click', cb);
		return this;
	}
}

export class ToggleComponent {
	toggleEl: HTMLElement;
	private value = false;
	private cb: ((v: boolean) => void) | null = null;
	constructor(containerEl: HTMLElement) {
		this.toggleEl = containerEl.createDiv('checkbox-container');
		this.toggleEl.createEl('input', { attr: { type: 'checkbox', tabindex: '0' } });
		this.toggleEl.addEventListener('click', () => {
			this.setValue(!this.value);
			this.cb?.(this.value);
		});
	}
	setValue(v: boolean): this {
		this.value = v;
		this.toggleEl.toggleClass('is-enabled', v);
		return this;
	}
	getValue(): boolean {
		return this.value;
	}
	onChange(cb: (v: boolean) => void): this {
		this.cb = cb;
		return this;
	}
}

export class Setting {
	settingEl: HTMLElement;
	infoEl: HTMLElement;
	nameEl: HTMLElement;
	descEl: HTMLElement;
	controlEl: HTMLElement;
	constructor(containerEl: HTMLElement) {
		this.settingEl = containerEl.createDiv('setting-item');
		this.infoEl = this.settingEl.createDiv('setting-item-info');
		this.nameEl = this.infoEl.createDiv('setting-item-name');
		this.descEl = this.infoEl.createDiv('setting-item-description');
		this.controlEl = this.settingEl.createDiv('setting-item-control');
	}
	setName(n: string): this {
		this.nameEl.setText(n);
		return this;
	}
	setDesc(d: string): this {
		this.descEl.setText(d);
		return this;
	}
	addText(cb: (t: TextComponent) => void): this {
		cb(new TextComponent(this.controlEl));
		return this;
	}
	addButton(cb: (b: ButtonComponent) => void): this {
		cb(new ButtonComponent(this.controlEl));
		return this;
	}
	addToggle(cb: (t: ToggleComponent) => void): this {
		cb(new ToggleComponent(this.controlEl));
		return this;
	}
	setHeading(): this {
		this.settingEl.addClass('setting-item-heading');
		return this;
	}
}

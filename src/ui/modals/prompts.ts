import { type App, Modal, Setting, SuggestModal } from 'obsidian';

/** Prompt for a single line of text. Resolves null if cancelled. */
export function promptText(
	app: App,
	opts: { title: string; placeholder?: string; value?: string; cta?: string },
): Promise<string | null> {
	return new Promise((resolve) => {
		const modal = new Modal(app);
		modal.titleEl.setText(opts.title);
		let value = opts.value ?? '';
		let submitted = false;

		new Setting(modal.contentEl).addText((text) => {
			text.setPlaceholder(opts.placeholder ?? '').setValue(value);
			text.inputEl.addClass('gymmd-prompt-input');
			text.onChange((v) => (value = v));
			text.inputEl.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					submitted = true;
					modal.close();
				}
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});

		new Setting(modal.contentEl)
			.addButton((b) =>
				b
					.setButtonText(opts.cta ?? 'Save')
					.setCta()
					.onClick(() => {
						submitted = true;
						modal.close();
					}),
			)
			.addButton((b) => b.setButtonText('Cancel').onClick(() => modal.close()));

		modal.onClose = () => resolve(submitted && value.trim() ? value.trim() : null);
		modal.open();
	});
}

/** Yes/no confirmation. Resolves true if the primary action was chosen. */
export function confirm(
	app: App,
	opts: { title: string; message?: string; cta?: string; danger?: boolean },
): Promise<boolean> {
	return new Promise((resolve) => {
		const modal = new Modal(app);
		modal.titleEl.setText(opts.title);
		if (opts.message) modal.contentEl.createEl('p', { text: opts.message });
		let result = false;

		new Setting(modal.contentEl)
			.addButton((b) => {
				b.setButtonText(opts.cta ?? 'Confirm').onClick(() => {
					result = true;
					modal.close();
				});
				if (opts.danger) b.setDestructive();
				else b.setCta();
			})
			.addButton((b) => b.setButtonText('Cancel').onClick(() => modal.close()));

		modal.onClose = () => resolve(result);
		modal.open();
	});
}

export interface ActionChoice {
	id: string;
	label: string;
	cta?: boolean;
	danger?: boolean;
}

/** Present a titled set of buttons. Resolves the chosen id, or null if dismissed. */
export function chooseAction(
	app: App,
	opts: { title: string; message?: string; actions: ActionChoice[] },
): Promise<string | null> {
	return new Promise((resolve) => {
		const modal = new Modal(app);
		modal.titleEl.setText(opts.title);
		if (opts.message) {
			modal.contentEl.createEl('p', { text: opts.message, cls: 'gymmd-pre-wrap' });
		}
		let chosen: string | null = null;

		const row = new Setting(modal.contentEl);
		for (const action of opts.actions) {
			row.addButton((b) => {
				b.setButtonText(action.label).onClick(() => {
					chosen = action.id;
					modal.close();
				});
				if (action.cta) b.setCta();
				if (action.danger) b.setDestructive();
			});
		}

		modal.onClose = () => resolve(chosen);
		modal.open();
	});
}

class ListPicker<T> extends SuggestModal<T> {
	constructor(
		app: App,
		private items: T[],
		private label: (item: T) => string,
		private onPick: (item: T | null) => void,
	) {
		super(app);
	}

	getSuggestions(query: string): T[] {
		const q = query.toLowerCase();
		return this.items.filter((i) => this.label(i).toLowerCase().includes(q));
	}

	renderSuggestion(item: T, el: HTMLElement): void {
		el.setText(this.label(item));
	}

	onChooseSuggestion(item: T): void {
		this.picked = true;
		this.onPick(item);
	}

	private picked = false;
	onClose(): void {
		super.onClose();
		if (!this.picked) this.onPick(null);
	}
}

/** Pick one item from a list via fuzzy suggest. Resolves null if dismissed. */
export function chooseFromList<T>(
	app: App,
	items: T[],
	label: (item: T) => string,
	placeholder?: string,
): Promise<T | null> {
	return new Promise((resolve) => {
		const picker = new ListPicker(app, items, label, resolve);
		if (placeholder) picker.setPlaceholder(placeholder);
		picker.open();
	});
}

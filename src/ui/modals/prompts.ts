import { type App, Modal, Setting } from 'obsidian';

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

/**
 * Prompt for a validated number. Resolves the value on save (or null if the
 * field was cleared), or `undefined` if cancelled/dismissed.
 *  - kind="reps":   positive integer 1–999.
 *  - kind="weight": ≥ 0, at most 2 decimals.
 */
export function promptNumber(
	app: App,
	opts: { title: string; kind: 'reps' | 'weight'; value: number | null },
): Promise<number | null | undefined> {
	return new Promise((resolve) => {
		const modal = new Modal(app);
		modal.titleEl.setText(opts.title);
		const allowed = opts.kind === 'reps' ? /^\d{0,3}$/ : /^\d{0,5}(\.\d{0,2})?$/;
		let text = opts.value === null ? '' : String(opts.value);
		let submitted = false;

		new Setting(modal.contentEl).addText((t) => {
			t.inputEl.inputMode = opts.kind === 'reps' ? 'numeric' : 'decimal';
			t.inputEl.setAttr('enterkeyhint', 'done');
			t.inputEl.addClass('gymmd-prompt-input');
			t.setValue(text);
			t.onChange((v) => {
				if (v !== '' && !allowed.test(v)) {
					t.setValue(text); // reject invalid keystroke
					return;
				}
				text = v;
			});
			t.inputEl.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					submitted = true;
					modal.close();
				}
			});
			window.setTimeout(() => {
				t.inputEl.focus();
				t.inputEl.select();
			}, 0);
		});

		new Setting(modal.contentEl)
			.addButton((b) =>
				b
					.setButtonText('Save')
					.setCta()
					.onClick(() => {
						submitted = true;
						modal.close();
					}),
			)
			.addButton((b) => b.setButtonText('Cancel').onClick(() => modal.close()));

		modal.onClose = () => {
			if (!submitted) return resolve(undefined);
			const trimmed = text.trim();
			if (trimmed === '') return resolve(null);
			const n = Number(trimmed);
			if (!Number.isFinite(n)) return resolve(undefined);
			if (opts.kind === 'reps') return resolve(Math.min(999, Math.max(1, Math.floor(n))));
			return resolve(Math.min(99999.99, Math.max(0, Math.round(n * 100) / 100)));
		};
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
				// mod-warning works on all Obsidian versions (setDestructive needs 1.13).
				if (opts.danger) b.buttonEl.addClass('mod-warning');
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
				if (action.danger) b.buttonEl.addClass('mod-warning');
			});
		}

		modal.onClose = () => resolve(chosen);
		modal.open();
	});
}


import { Modal } from 'obsidian';
import { StrictMode, type ReactElement } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import type GymMDPlugin from '../../main';
import { PluginContext } from '../context';

/** A Modal whose body is a React tree with the plugin available in context. */
export class ReactModal extends Modal {
	private root: Root | null = null;

	constructor(
		private plugin: GymMDPlugin,
		private render: (close: () => void) => ReactElement,
		opts?: { title?: string; wide?: boolean },
	) {
		super(plugin.app);
		if (opts?.title) this.titleEl.setText(opts.title);
		if (opts?.wide) this.modalEl.addClass('gymmd-wide-modal');
	}

	onOpen(): void {
		this.root = createRoot(this.contentEl);
		this.root.render(
			<StrictMode>
				<PluginContext.Provider value={this.plugin}>
					{this.render(() => this.close())}
				</PluginContext.Provider>
			</StrictMode>,
		);
	}

	onClose(): void {
		this.root?.unmount();
		this.root = null;
		this.contentEl.empty();
	}
}

export function openReactModal(
	plugin: GymMDPlugin,
	render: (close: () => void) => ReactElement,
	opts?: { title?: string; wide?: boolean },
): void {
	new ReactModal(plugin, render, opts).open();
}

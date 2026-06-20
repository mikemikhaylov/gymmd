import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { StrictMode, type ReactElement } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import type GymMDPlugin from '../../main';
import { PluginContext } from '../context';

/** Base ItemView that renders a React tree with the plugin available in context. */
export abstract class ReactItemView extends ItemView {
	protected root: Root | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		protected plugin: GymMDPlugin,
	) {
		super(leaf);
	}

	/** The React element to render inside the view. */
	protected abstract renderContent(): ReactElement;

	async onOpen(): Promise<void> {
		this.root = createRoot(this.contentEl);
		this.root.render(
			<StrictMode>
				<PluginContext.Provider value={this.plugin}>{this.renderContent()}</PluginContext.Provider>
			</StrictMode>,
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}
}

import { Plugin, WorkspaceLeaf } from 'obsidian';
import { DoseView, VIEW_TYPE_DOSE } from './views/dose-view';
import { DoseSettingTab } from './settings';
import { Store } from './store';
import { DoseStore } from './types';
import { loadProtocols } from './protocol-loader';

export default class DosePlugin extends Plugin {
  store!: Store;

  async onload() {
    const saved = (await this.loadData()) as Partial<DoseStore> | null;
    this.store = new Store(saved ?? {}, async (data) => {
      await this.saveData(data);
    });

    this.registerView(VIEW_TYPE_DOSE, (leaf) => new DoseView(leaf, this));

    this.addRibbonIcon('pill', 'Dose', () => this.activateView());

    this.addSettingTab(new DoseSettingTab(this.app, this));

    this.addCommand({
      id: 'open-dose',
      name: 'Open Dose tracker',
      callback: () => this.activateView(),
    });

    await this.refreshProtocols();
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_DOSE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE_DOSE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async refreshProtocols(): Promise<void> {
    const folder = this.store.getSettings().protocolsFolder;
    const protocols = await loadProtocols(this.app, folder);
    for (const protocol of protocols) {
      const existing = this.store.getProtocols().find(p => p.id === protocol.id);
      // type is intentionally re-read from frontmatter on each refresh; the vault file is the source of truth
      this.store.upsertProtocol({
        ...protocol,
        status: existing?.status ?? protocol.status,
      });
    }
    await this.store.save();
  }

  onunload(): void {}
}

import { ItemView, WorkspaceLeaf } from 'obsidian';
import DosePlugin from '../main';
import { renderTodayTab } from './today-tab';
import { renderDashboardTab } from './dashboard-tab';
import { renderPlanningTab } from './planning-tab';

export const VIEW_TYPE_DOSE = 'dose-view';

type Tab = 'today' | 'dashboard' | 'planning';

export class DoseView extends ItemView {
  private plugin: DosePlugin;
  private activeTab: Tab = 'today';

  constructor(leaf: WorkspaceLeaf, plugin: DosePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return VIEW_TYPE_DOSE; }
  getDisplayText(): string { return 'Dose'; }
  getIcon(): string { return 'pill'; }

  async onOpen(): Promise<void> {
    this.render();
  }

  render(): void {
    const { contentEl } = this;
    contentEl.empty();

    const tabBar = contentEl.createDiv({ cls: 'dose-tab-bar' });
    const tabs: Tab[] = ['today', 'dashboard', 'planning'];

    for (const tab of tabs) {
      const btn = tabBar.createEl('button', {
        text: tab.charAt(0).toUpperCase() + tab.slice(1),
        cls: `dose-tab-btn${this.activeTab === tab ? ' active' : ''}`,
      });
      btn.addEventListener('click', () => {
        this.activeTab = tab;
        this.render();
      });
    }

    const content = contentEl.createDiv({ cls: 'dose-tab-content' });
    const refresh = () => this.render();

    if (this.activeTab === 'today') renderTodayTab(content, this.plugin, refresh);
    else if (this.activeTab === 'dashboard') renderDashboardTab(content, this.plugin);
    else renderPlanningTab(content, this.plugin, refresh);
  }

  async onClose(): Promise<void> {}
}

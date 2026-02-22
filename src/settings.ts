import { App, PluginSettingTab, Setting } from 'obsidian';
import DosePlugin from './main';

export class DoseSettingTab extends PluginSettingTab {
  plugin: DosePlugin;

  constructor(app: App, plugin: DosePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Dose Settings' });

    const settings = this.plugin.store.getSettings();

    new Setting(containerEl)
      .setName('Protocols folder')
      .setDesc('Vault folder containing protocol notes (e.g. Protocols)')
      .addText(text =>
        text.setValue(settings.protocolsFolder).onChange(async value => {
          this.plugin.store.updateSettings({ protocolsFolder: value });
          await this.plugin.store.save();
        }),
      );

    new Setting(containerEl)
      .setName('Daily notes folder')
      .setDesc('Vault folder containing daily notes named YYYY-MM-DD.md (e.g. Notes)')
      .addText(text =>
        text.setValue(settings.dailyNotesFolder).onChange(async value => {
          this.plugin.store.updateSettings({ dailyNotesFolder: value });
          await this.plugin.store.save();
        }),
      );

    new Setting(containerEl)
      .setName('Injection sites')
      .setDesc('Comma-separated list of injection sites')
      .addTextArea(text =>
        text.setValue(settings.injectionSites.join(', ')).onChange(async value => {
          const sites = value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          this.plugin.store.updateSettings({ injectionSites: sites });
          await this.plugin.store.save();
        }),
      );
  }
}

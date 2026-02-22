import { App, Modal, Setting } from 'obsidian';
import { Compound, DoseLog } from '../types';

export class LogDoseModal extends Modal {
  private compound: Compound;
  private protocolId: string;
  private injectionSites: string[];
  private onSubmit: (log: DoseLog) => Promise<void>;

  private dose: string;
  private site: string;
  private timestamp: string;

  constructor(
    app: App,
    compound: Compound,
    protocolId: string,
    injectionSites: string[],
    onSubmit: (log: DoseLog) => Promise<void>,
  ) {
    super(app);
    this.compound = compound;
    this.protocolId = protocolId;
    this.injectionSites = injectionSites;
    this.onSubmit = onSubmit;
    this.dose = compound.dose;
    this.site = injectionSites[0] ?? '';
    this.timestamp = new Date().toISOString();
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: `Log Dose — ${this.compound.name}` });

    new Setting(contentEl)
      .setName('Dose')
      .addText(text =>
        text.setValue(this.dose).onChange(v => { this.dose = v; }),
      );

    new Setting(contentEl)
      .setName('Injection site')
      .addDropdown(drop => {
        for (const site of this.injectionSites) drop.addOption(site, site);
        drop.setValue(this.site).onChange(v => { this.site = v; });
      });

    new Setting(contentEl)
      .setName('Time')
      .setDesc('HH:MM (24h)')
      .addText(text => {
        const now = new Date();
        const localTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        text.setValue(localTime).onChange(v => {
          const [h, m] = v.split(':').map(Number);
          if (!isNaN(h) && !isNaN(m)) {
            const d = new Date();
            d.setHours(h, m, 0, 0);
            this.timestamp = d.toISOString();
          }
        });
      });

    new Setting(contentEl)
      .addButton(btn =>
        btn
          .setButtonText('Log Dose')
          .setCta()
          .onClick(async () => {
            const log: DoseLog = {
              id: crypto.randomUUID(),
              protocolId: this.protocolId,
              compoundName: this.compound.name,
              dose: this.dose,
              site: this.site,
              timestamp: this.timestamp,
              status: 'taken',
            };
            await this.onSubmit(log);
            this.close();
          }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

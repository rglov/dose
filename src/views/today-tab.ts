import { Notice } from 'obsidian';
import DosePlugin from '../main';
import { getDueToday, getExpectedDoseCount } from '../schedule';
import { Compound, DoseLog } from '../types';
import { LogDoseModal } from '../modals/log-dose-modal';
import { appendDoseToNote } from '../daily-note';

export function renderTodayTab(el: HTMLElement, plugin: DosePlugin, refresh: () => void): void {
  const activeProtocols = plugin.store.getActiveProtocols();

  if (!activeProtocols.length) {
    el.createEl('p', { text: 'No active protocol. Go to Planning to activate one.' });
    return;
  }

  const today = new Date();
  const dateStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  const todayLogs = plugin.store.getDoseLogsForDate(dateStr);

  el.createEl('h3', { text: `Today — ${dateStr}` });

  // --- Injectables ---
  // Pair each due compound with its source protocolId
  type DueItem = { compound: Compound; protocolId: string };
  const dueItems: DueItem[] = activeProtocols
    .filter(p => p.type === 'injectable')
    .flatMap(p => getDueToday(p, today).map(c => ({ compound: c, protocolId: p.id })));

  if (dueItems.length > 0) {
    el.createEl('h4', { text: 'Injectables' });
    const list = el.createEl('ul', { cls: 'dose-today-list' });

    for (const { compound, protocolId } of dueItems) {
      const expected = getExpectedDoseCount(compound);
      const taken = todayLogs.filter(
        l => l.compoundName === compound.name && l.status === 'taken',
      ).length;
      const skipped = todayLogs.filter(
        l => l.compoundName === compound.name && l.status === 'skipped',
      ).length;

      const item = list.createEl('li', { cls: 'dose-today-item' });
      const statusText = taken >= expected ? '✓' : `${taken}/${expected}`;

      item.createEl('span', {
        text: `${compound.name} — ${compound.dose} (${statusText})`,
        cls: taken >= expected ? 'dose-done' : '',
      });

      if (taken < expected) {
        const logBtn = item.createEl('button', { text: 'Log Dose', cls: 'dose-log-btn' });
        logBtn.addEventListener('click', () => {
          const settings = plugin.store.getSettings();
          new LogDoseModal(
            plugin.app,
            compound,
            protocolId,
            settings.injectionSites,
            async (log) => {
              plugin.store.addDoseLog(log);
              await plugin.store.save();
              try {
                await appendDoseToNote(plugin.app, settings.dailyNotesFolder, log);
              } catch (err) {
                console.error('[Dose] Failed to write to daily note:', err);
                new Notice('Dose logged but failed to write to daily note. Check console.');
              }
              new Notice(`Logged ${compound.name}`);
              refresh();
            },
          ).open();
        });

        if (skipped === 0) {
          const skipBtn = item.createEl('button', { text: 'Skip', cls: 'dose-skip-btn' });
          skipBtn.addEventListener('click', async () => {
            const log: DoseLog = {
              id: crypto.randomUUID(),
              protocolId,
              compoundName: compound.name,
              dose: compound.dose,
              site: '',
              compoundType: 'injectable',
              timestamp: new Date().toISOString(),
              status: 'skipped',
            };
            plugin.store.addDoseLog(log);
            await plugin.store.save();
            new Notice(`Skipped ${compound.name}`);
            refresh();
          });
        }
      }
    }
  }

  // --- Supplements ---
  // All active protocols that have supplement groups
  const supplementProtocols = activeProtocols.filter(p => p.supplementGroups.length > 0);
  const showProtocolLabel = supplementProtocols.length > 1;

  if (supplementProtocols.length > 0) {
    el.createEl('h4', { text: 'Supplements' });

    for (const protocol of supplementProtocols) {
      if (showProtocolLabel) {
        el.createEl('p', { text: protocol.name, cls: 'dose-supplement-protocol-label' });
      }

      for (const group of protocol.supplementGroups) {
        const unlogged = group.items.filter(item =>
          !todayLogs.some(l => l.compoundName === item.name && l.compoundType === 'supplement'),
        );

        if (unlogged.length === 0) continue;

        const groupHeader = el.createDiv({ cls: 'dose-supplement-group-header' });
        groupHeader.createEl('span', { text: group.timeLabel, cls: 'dose-supplement-group-label' });

        const logAllBtn = groupHeader.createEl('button', { text: 'Log All', cls: 'dose-log-all-btn' });
        logAllBtn.addEventListener('click', async () => {
          const settings = plugin.store.getSettings();
          const now = new Date();
          for (const item of unlogged) {
            const log: DoseLog = {
              id: crypto.randomUUID(),
              protocolId: protocol.id,
              compoundName: item.name,
              dose: item.dose,
              site: '',
              compoundType: 'supplement',
              timestamp: now.toISOString(),
              status: 'taken',
            };
            plugin.store.addDoseLog(log);
            try {
              await appendDoseToNote(plugin.app, settings.dailyNotesFolder, log);
            } catch (err) {
              console.error('[Dose] Failed to write supplement to daily note:', err);
            }
          }
          await plugin.store.save();
          new Notice(`Logged ${group.timeLabel}`);
          refresh();
        });

        const supList = el.createEl('ul', { cls: 'dose-today-list' });

        for (const item of unlogged) {
          const label = item.dose ? `${item.name} — ${item.dose}` : item.name;
          const supItem = supList.createEl('li', { cls: 'dose-today-item' });
          supItem.createEl('span', { text: label });

          const logBtn = supItem.createEl('button', { text: '✓', cls: 'dose-log-btn' });
          logBtn.addEventListener('click', async () => {
            const log: DoseLog = {
              id: crypto.randomUUID(),
              protocolId: protocol.id,
              compoundName: item.name,
              dose: item.dose,
              site: '',
              compoundType: 'supplement',
              timestamp: new Date().toISOString(),
              status: 'taken',
            };
            plugin.store.addDoseLog(log);
            await plugin.store.save();
            const settings = plugin.store.getSettings();
            try {
              await appendDoseToNote(plugin.app, settings.dailyNotesFolder, log);
            } catch (err) {
              console.error('[Dose] Failed to write supplement to daily note:', err);
              new Notice('Supplement logged but failed to write to daily note. Check console.');
            }
            new Notice(`Logged ${item.name}`);
            refresh();
          });
        }
      }
    }
  }

  if (!dueItems.length && !supplementProtocols.length) {
    el.createEl('p', { text: 'Nothing scheduled today.' });
  }
}

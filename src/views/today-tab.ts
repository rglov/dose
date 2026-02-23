import { Notice } from 'obsidian';
import DosePlugin from '../main';
import { getDueToday, getExpectedDoseCount } from '../schedule';
import { DoseLog } from '../types';
import { LogDoseModal } from '../modals/log-dose-modal';
import { appendDoseToNote } from '../daily-note';

export function renderTodayTab(el: HTMLElement, plugin: DosePlugin, refresh: () => void): void {
  const protocol = plugin.store.getActiveProtocol();

  if (!protocol) {
    el.createEl('p', { text: 'No active protocol. Go to Planning to activate one.' });
    return;
  }

  const today = new Date();
  const dateStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  const dueCompounds = getDueToday(protocol, today);
  const todayLogs = plugin.store.getDoseLogsForDate(dateStr);

  el.createEl('h3', { text: `Today — ${dateStr}` });

  // --- Injectables ---
  if (dueCompounds.length > 0) {
    el.createEl('h4', { text: 'Injectables' });
    const list = el.createEl('ul', { cls: 'dose-today-list' });

    for (const compound of dueCompounds) {
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
            protocol.id,
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
              protocolId: protocol.id,
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
  if (protocol.supplementGroups.length > 0) {
    el.createEl('h4', { text: 'Supplements' });

    for (const group of protocol.supplementGroups) {
      el.createEl('p', { text: group.timeLabel, cls: 'dose-supplement-group-label' });
      const supList = el.createEl('ul', { cls: 'dose-today-list' });

      for (const item of group.items) {
        const supLogs = todayLogs.filter(
          l => l.compoundName === item.name && l.compoundType === 'supplement',
        );
        const logged = supLogs.length > 0;
        const label = item.dose ? `${item.name} — ${item.dose}` : item.name;

        const supItem = supList.createEl('li', { cls: 'dose-today-item' });
        supItem.createEl('span', {
          text: label,
          cls: logged ? 'dose-done' : '',
        });

        if (logged) {
          const lastLog = supLogs[supLogs.length - 1];
          const d = new Date(lastLog.timestamp);
          const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
          supItem.createEl('span', { text: ` ✓ ${timeStr}`, cls: 'dose-supplement-time' });
        } else {
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

  if (!dueCompounds.length && !protocol.supplementGroups.length) {
    el.createEl('p', { text: 'Nothing scheduled today.' });
  }
}

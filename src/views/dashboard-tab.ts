import DosePlugin from '../main';
import { calculateAdherence, calculateStreak, getDueToday, getExpectedDoseCount } from '../schedule';
import { DoseLog, Protocol } from '../types';

export function renderDashboardTab(el: HTMLElement, plugin: DosePlugin): void {
  const protocol = plugin.store.getActiveProtocol();

  if (!protocol) {
    el.createEl('p', { text: 'No active protocol.' });
    return;
  }

  const logs = plugin.store.getDoseLogsForProtocol(protocol.id);
  const startDate = new Date(protocol.startDate);
  const today = new Date();

  // Cycle progress
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksElapsed = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / msPerWeek));
  const weekNum = Math.min(weeksElapsed + 1, protocol.durationWeeks);
  const pct = Math.min(100, Math.round((weeksElapsed / protocol.durationWeeks) * 100));

  el.createEl('h3', { text: protocol.name });

  const progress = el.createDiv({ cls: 'dose-progress' });
  progress.createEl('p', { text: `Week ${weekNum} of ${protocol.durationWeeks} — ${pct}% complete` });
  const bar = progress.createDiv({ cls: 'dose-progress-bar' });
  bar.createDiv({ cls: 'dose-progress-fill', attr: { style: `width: ${pct}%` } });

  // Streak
  const streak = calculateStreak(logs, protocol);
  el.createEl('p', { text: `🔥 Current streak: ${streak} day${streak !== 1 ? 's' : ''}` });

  // Adherence per injectable compound
  el.createEl('h4', { text: 'Injectable Adherence' });
  const adherence = calculateAdherence(protocol, logs, startDate, today);
  const adList = el.createEl('ul', { cls: 'dose-adherence-list' });
  for (const [name, adherencePct] of Object.entries(adherence)) {
    const item = adList.createEl('li');
    item.createEl('span', { text: `${name}: ` });
    item.createEl('strong', { text: `${adherencePct}%` });
  }

  // Supplement adherence
  if (protocol.supplementGroups.length > 0) {
    el.createEl('h4', { text: 'Supplement Adherence' });
    const daysElapsed = Math.max(1, Math.floor(
      (today.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
    ) + 1);
    const supAdList = el.createEl('ul', { cls: 'dose-adherence-list' });

    for (const group of protocol.supplementGroups) {
      for (const item of group.items) {
        const expected = daysElapsed;
        const taken = logs.filter(
          l => l.compoundName === item.name &&
               l.compoundType === 'supplement' &&
               l.status === 'taken',
        ).length;
        const pct = Math.round((taken / expected) * 100);
        const li = supAdList.createEl('li');
        li.createEl('span', { text: `${item.name} (${group.timeLabel}): ` });
        li.createEl('strong', { text: `${pct}%` });
      }
    }
  }

  // Heatmap — last 30 days
  el.createEl('h4', { text: 'Last 30 Days' });
  renderHeatmap(el, protocol, logs, today);

  // Per-compound history
  el.createEl('h4', { text: 'Dose History' });
  renderHistory(el, logs);
}

function renderHeatmap(el: HTMLElement, protocol: Protocol, logs: DoseLog[], today: Date): void {
  const grid = el.createDiv({ cls: 'dose-heatmap' });

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');

    const dueCompounds = getDueToday(protocol, date);
    const dayLogs = logs.filter(l => l.timestamp.startsWith(dateStr) && l.status === 'taken');
    const supplementCount = protocol.supplementGroups.reduce(
      (sum, g) => sum + g.items.length, 0,
    );
    const totalExpected = dueCompounds.reduce((sum, c) => sum + getExpectedDoseCount(c), 0) + supplementCount;

    let cls = 'dose-heatmap-cell';
    if (!dueCompounds.length && !supplementCount) cls += ' none';
    else if (dayLogs.length === 0) cls += ' missed';
    else if (dayLogs.length < totalExpected) cls += ' partial';
    else cls += ' full';

    const cell = grid.createDiv({ cls });
    cell.title = dateStr;
  }
}

function renderHistory(el: HTMLElement, logs: DoseLog[]): void {
  if (!logs.length) {
    el.createEl('p', { text: 'No doses logged yet.' });
    return;
  }

  const sorted = [...logs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const table = el.createEl('table', { cls: 'dose-history-table' });
  const header = table.createEl('tr');
  ['Date', 'Time', 'Compound', 'Dose', 'Site', 'Status'].forEach(h =>
    header.createEl('th', { text: h }),
  );

  for (const log of sorted.slice(0, 50)) {
    const d = new Date(log.timestamp);
    const dateStr = d.toLocaleDateString();
    const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    const row = table.createEl('tr');
    [dateStr, timeStr, log.compoundName, log.dose, log.site, log.status].forEach(v =>
      row.createEl('td', { text: v }),
    );
  }
}

import DosePlugin from '../main';
import { calculateAdherence, calculateStreak, getDueToday, getExpectedDoseCount } from '../schedule';
import { DoseLog, Protocol } from '../types';

export function renderDashboardTab(el: HTMLElement, plugin: DosePlugin): void {
  const activeProtocols = plugin.store.getActiveProtocols();

  if (!activeProtocols.length) {
    el.createEl('p', { text: 'No active protocol.' });
    return;
  }

  const today = new Date();
  for (const protocol of activeProtocols) {
    const logs = plugin.store.getDoseLogsForProtocol(protocol.id);
    if (protocol.type === 'injectable') {
      renderInjectableCard(el, protocol, logs, today);
    } else {
      renderSupplementCard(el, protocol, logs, today);
    }
  }
}

function renderInjectableCard(el: HTMLElement, protocol: Protocol, logs: DoseLog[], today: Date): void {
  const startDate = new Date(protocol.startDate);

  const card = el.createDiv({ cls: 'dose-protocol-card' });
  card.createEl('h3', { text: protocol.name });

  // Cycle progress
  if (protocol.durationWeeks > 0) {
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksElapsed = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / msPerWeek));
    const weekNum = Math.min(weeksElapsed + 1, protocol.durationWeeks);
    const pct = Math.min(100, Math.round((weeksElapsed / protocol.durationWeeks) * 100));

    const progress = card.createDiv({ cls: 'dose-progress' });
    progress.createEl('p', { text: `Week ${weekNum} of ${protocol.durationWeeks} — ${pct}% complete` });
    const bar = progress.createDiv({ cls: 'dose-progress-bar' });
    bar.createDiv({ cls: 'dose-progress-fill', attr: { style: `width: ${pct}%` } });
  }

  // Streak
  const streak = calculateStreak(logs, protocol);
  card.createEl('p', { text: `🔥 Current streak: ${streak} day${streak !== 1 ? 's' : ''}` });

  // Injectable adherence
  card.createEl('h4', { text: 'Injectable Adherence' });
  const adherence = calculateAdherence(protocol, logs, startDate, today);
  const adList = card.createEl('ul', { cls: 'dose-adherence-list' });
  for (const [name, adherencePct] of Object.entries(adherence)) {
    const item = adList.createEl('li');
    item.createEl('span', { text: `${name}: ` });
    item.createEl('strong', { text: `${adherencePct}%` });
  }

  // Supplement adherence (if protocol has supplement groups)
  if (protocol.supplementGroups.length > 0) {
    card.createEl('h4', { text: 'Supplement Adherence' });
    renderSupplementAdherence(card, protocol, logs, startDate, today);
  }

  // Heatmap
  card.createEl('h4', { text: 'Last 30 Days' });
  renderHeatmap(card, protocol, logs, today);

  // History
  card.createEl('h4', { text: 'Dose History' });
  renderHistory(card, logs);
}

function renderSupplementCard(el: HTMLElement, protocol: Protocol, logs: DoseLog[], today: Date): void {
  const startDate = new Date(protocol.startDate);

  const card = el.createDiv({ cls: 'dose-protocol-card' });
  card.createEl('h3', { text: protocol.name });

  if (protocol.supplementGroups.length === 0) {
    card.createEl('p', { text: 'No supplement groups defined.' });
    return;
  }

  card.createEl('h4', { text: 'Supplement Adherence' });
  renderSupplementAdherence(card, protocol, logs, startDate, today);
}

function renderSupplementAdherence(
  el: HTMLElement,
  protocol: Protocol,
  logs: DoseLog[],
  startDate: Date,
  today: Date,
): void {
  const startStr = startDate.toISOString().split('T')[0];
  // Assumes 1 expected dose per supplement item per day
  const daysElapsed = Math.max(1, Math.floor(
    (today.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
  ));
  const adList = el.createEl('ul', { cls: 'dose-adherence-list' });
  for (const group of protocol.supplementGroups) {
    for (const item of group.items) {
      const taken = logs.filter(
        l => l.compoundName === item.name &&
             l.compoundType === 'supplement' &&
             l.status === 'taken' &&
             l.timestamp >= startStr,
      ).length;
      const pct = Math.min(100, Math.round((taken / daysElapsed) * 100));
      const li = adList.createEl('li');
      li.createEl('span', { text: `${item.name} (${group.timeLabel}): ` });
      li.createEl('strong', { text: `${pct}%` });
    }
  }
}

function renderHeatmap(el: HTMLElement, protocol: Protocol, logs: DoseLog[], today: Date): void {
  const grid = el.createDiv({ cls: 'dose-heatmap' });
  const supplementCount = protocol.supplementGroups.reduce(
    (sum, g) => sum + g.items.length, 0,
  );

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

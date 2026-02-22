import { Notice } from 'obsidian';
import DosePlugin from '../main';
import { Protocol } from '../types';

export function renderPlanningTab(el: HTMLElement, plugin: DosePlugin, refresh: () => void): void {
  el.createEl('h3', { text: 'Protocols' });

  const protocols = plugin.store.getProtocols();

  if (!protocols.length) {
    el.createEl('p', {
      text: 'No protocols found. Add protocol notes to your Protocols folder and click Refresh.',
    });
  } else {
    const groups: Record<string, Protocol[]> = {
      active: protocols.filter(p => p.status === 'active'),
      planned: protocols.filter(p => p.status === 'planned'),
      paused: protocols.filter(p => p.status === 'paused'),
      completed: protocols.filter(p => p.status === 'completed'),
    };

    for (const [status, group] of Object.entries(groups)) {
      if (!group.length) continue;
      el.createEl('h4', { text: status.charAt(0).toUpperCase() + status.slice(1) });
      const list = el.createEl('ul', { cls: 'dose-protocol-list' });
      for (const protocol of group) {
        renderProtocolItem(list, protocol, plugin, refresh);
      }
    }
  }

  // Refresh button
  const refreshBtn = el.createEl('button', { text: 'Refresh from vault', cls: 'dose-refresh-btn' });
  refreshBtn.addEventListener('click', async () => {
    await plugin.refreshProtocols();
    new Notice('Protocols refreshed');
    refresh();
  });
}

function renderProtocolItem(
  el: HTMLElement,
  protocol: Protocol,
  plugin: DosePlugin,
  refresh: () => void,
): void {
  const item = el.createEl('li', { cls: 'dose-protocol-item' });

  const info = item.createDiv({ cls: 'dose-protocol-info' });
  info.createEl('strong', { text: protocol.name });
  info.createEl('span', {
    text: ` — ${protocol.durationWeeks} weeks, ${protocol.compounds.length} compounds`,
  });

  const compoundList = info.createEl('ul', { cls: 'dose-compound-list' });
  for (const compound of protocol.compounds) {
    compoundList.createEl('li', {
      text: `${compound.name}: ${compound.dose} (${compound.route})`,
    });
  }

  const actions = item.createDiv({ cls: 'dose-protocol-actions' });

  if (protocol.status !== 'active') {
    const activateBtn = actions.createEl('button', { text: 'Activate' });
    activateBtn.addEventListener('click', async () => {
      plugin.store.activateProtocol(protocol.id);
      await plugin.store.save();
      new Notice(`${protocol.name} activated`);
      refresh();
    });
  } else {
    actions.createEl('span', { text: '✓ Active', cls: 'dose-active-badge' });
  }
}

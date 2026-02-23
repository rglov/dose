# Multi-Protocol & Protocol Types Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow multiple protocols to be active simultaneously by adding a `type` field (`injectable` | `supplement`) — injectable protocols stay single-active, supplement protocols stack freely.

**Architecture:** Add `ProtocolType` to types, make `activateProtocol` type-aware, add `getActiveProtocols()` returning all active, split the Planning tab into two typed sections, merge all active protocols in Today tab, render one dashboard card per active protocol.

**Tech Stack:** TypeScript, Obsidian Plugin API, Jest + ts-jest, esbuild

---

## Context

- Plugin source: `src/` at `/Users/rglov/Documents/CRG/PROJECTS/Dose`
- Tests: `tests/` — 47 passing tests
- Build: `npm run build` → `main.js`
- Install: copy `main.js` + `styles.css` to `/Users/rglov/Documents/CRG/.obsidian/plugins/dose/`
- Vault protocol note: `/Users/rglov/Documents/CRG/NOTES/Protocols/Dose Protocol v2026.02.md`

---

## Task 1: Add `ProtocolType` and Update Store

**Files:**
- Modify: `src/types.ts`
- Modify: `src/store.ts`
- Modify: `tests/store.test.ts`

### Step 1: Update `src/types.ts`

Add `ProtocolType` and `type` field to `Protocol`. Replace the entire file:

```typescript
export type ProtocolStatus = 'active' | 'planned' | 'paused' | 'completed';
export type ProtocolType = 'injectable' | 'supplement';
export type DoseStatus = 'taken' | 'skipped' | 'extra';
export type FrequencyType = 'daily' | 'twice_daily' | 'weekly';

export interface CompoundFrequency {
  type: FrequencyType;
  days?: number[]; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
}

export interface Compound {
  name: string;
  dose: string;
  route: string;
  frequency: CompoundFrequency;
}

export interface SupplementItem {
  name: string;
  dose: string; // e.g. "3x", "5mg", "" if not specified
}

export interface SupplementGroup {
  timeLabel: string; // e.g. "Morning (fasted)", "Breakfast 8AM"
  items: SupplementItem[];
}

export interface Protocol {
  id: string;          // vault file path, used as unique key
  name: string;
  type: ProtocolType;  // 'injectable' | 'supplement'
  status: ProtocolStatus;
  startDate: string;   // YYYY-MM-DD
  durationWeeks: number;
  compounds: Compound[];
  supplementGroups: SupplementGroup[];
  filePath: string;
}

export interface DoseLog {
  id: string;
  protocolId: string;
  compoundName: string;
  dose: string;
  site: string;
  compoundType: 'injectable' | 'supplement';
  timestamp: string;   // ISO 8601
  status: DoseStatus;
}

export interface DoseSettings {
  protocolsFolder: string;
  dailyNotesFolder: string;
  injectionSites: string[];
}

export interface DoseStore {
  version: number;
  protocols: Protocol[];
  doseLogs: DoseLog[];
  settings: DoseSettings;
}
```

### Step 2: Write failing tests for new store methods

Add the following tests to `tests/store.test.ts` inside the existing `describe('Store', ...)` block, before the final `});`:

```typescript
  // --- Multi-protocol tests ---

  test('getActiveProtocols returns all active protocols', () => {
    store.upsertProtocol({ ...mockProtocol, id: 'a.md', status: 'active', type: 'injectable' });
    store.upsertProtocol({ ...mockProtocol, id: 'b.md', status: 'active', type: 'supplement' });
    store.upsertProtocol({ ...mockProtocol, id: 'c.md', status: 'planned', type: 'supplement' });
    expect(store.getActiveProtocols()).toHaveLength(2);
  });

  test('getActiveProtocol returns only active injectable', () => {
    store.upsertProtocol({ ...mockProtocol, id: 'a.md', status: 'active', type: 'injectable' });
    store.upsertProtocol({ ...mockProtocol, id: 'b.md', status: 'active', type: 'supplement' });
    expect(store.getActiveProtocol()?.id).toBe('a.md');
  });

  test('activating injectable pauses other active injectable but not supplement', () => {
    store.upsertProtocol({ ...mockProtocol, id: 'inj1.md', status: 'active', type: 'injectable' });
    store.upsertProtocol({ ...mockProtocol, id: 'inj2.md', status: 'planned', type: 'injectable' });
    store.upsertProtocol({ ...mockProtocol, id: 'sup.md', status: 'active', type: 'supplement' });
    store.activateProtocol('inj2.md');
    expect(store.getProtocols().find(p => p.id === 'inj1.md')?.status).toBe('paused');
    expect(store.getProtocols().find(p => p.id === 'inj2.md')?.status).toBe('active');
    expect(store.getProtocols().find(p => p.id === 'sup.md')?.status).toBe('active');
  });

  test('activating supplement does not affect other protocols', () => {
    store.upsertProtocol({ ...mockProtocol, id: 'inj.md', status: 'active', type: 'injectable' });
    store.upsertProtocol({ ...mockProtocol, id: 'sup1.md', status: 'active', type: 'supplement' });
    store.upsertProtocol({ ...mockProtocol, id: 'sup2.md', status: 'planned', type: 'supplement' });
    store.activateProtocol('sup2.md');
    expect(store.getProtocols().find(p => p.id === 'inj.md')?.status).toBe('active');
    expect(store.getProtocols().find(p => p.id === 'sup1.md')?.status).toBe('active');
    expect(store.getProtocols().find(p => p.id === 'sup2.md')?.status).toBe('active');
  });

  test('deactivateProtocol sets status to paused', () => {
    store.upsertProtocol({ ...mockProtocol, id: 'sup.md', status: 'active', type: 'supplement' });
    store.deactivateProtocol('sup.md');
    expect(store.getProtocols().find(p => p.id === 'sup.md')?.status).toBe('paused');
  });
```

Also add `type: 'injectable'` to `mockProtocol` at the top of the test file:

```typescript
const mockProtocol: Protocol = {
  id: 'Protocols/test.md',
  name: 'Test Protocol',
  type: 'injectable',
  status: 'planned',
  startDate: '2026-02-22',
  durationWeeks: 12,
  compounds: [],
  supplementGroups: [],
  filePath: 'Protocols/test.md',
};
```

### Step 3: Run tests to verify they fail

Run: `npm test -- --testPathPattern=store`

Expected: FAIL — `getActiveProtocols is not a function`, `deactivateProtocol is not a function`, TypeScript errors on `type` field.

### Step 4: Update `src/store.ts`

Replace the entire file:

```typescript
import { DoseStore, Protocol, DoseLog, DoseSettings, SupplementGroup, ProtocolType } from './types';

const DEFAULT_SETTINGS: DoseSettings = {
  protocolsFolder: 'Protocols',
  dailyNotesFolder: 'Notes',
  injectionSites: [
    'Left abdomen', 'Right abdomen',
    'Left thigh', 'Right thigh',
    'Left delt', 'Right delt',
  ],
};

const DEFAULT_STORE: DoseStore = {
  version: 1,
  protocols: [],
  doseLogs: [],
  settings: DEFAULT_SETTINGS,
};

export class Store {
  private data: DoseStore;
  private saveCallback: (data: DoseStore) => Promise<void>;

  constructor(saved: Partial<DoseStore>, saveCallback: (data: DoseStore) => Promise<void>) {
    this.data = {
      version: saved.version ?? DEFAULT_STORE.version,
      protocols: saved.protocols
        ? saved.protocols.map(p => ({
            type: 'injectable' as ProtocolType,
            supplementGroups: [] as SupplementGroup[],
            ...p,
            supplementGroups: (p as Protocol).supplementGroups ?? ([] as SupplementGroup[]),
          }))
        : [],
      doseLogs: saved.doseLogs
        ? saved.doseLogs.map(l => ({ ...l, compoundType: (l as DoseLog).compoundType ?? ('injectable' as const) }))
        : [],
      settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
    };
    this.saveCallback = saveCallback;
  }

  getProtocols(): Protocol[] { return this.data.protocols; }

  getActiveProtocol(): Protocol | undefined {
    return this.data.protocols.find(p => p.status === 'active' && p.type === 'injectable');
  }

  getActiveProtocols(): Protocol[] {
    return this.data.protocols.filter(p => p.status === 'active');
  }

  upsertProtocol(protocol: Protocol): void {
    const idx = this.data.protocols.findIndex(p => p.id === protocol.id);
    if (idx >= 0) {
      this.data.protocols[idx] = protocol;
    } else {
      this.data.protocols.push(protocol);
    }
  }

  activateProtocol(id: string): void {
    const target = this.data.protocols.find(p => p.id === id);
    if (!target) return;
    this.data.protocols = this.data.protocols.map(p => ({
      ...p,
      status: p.id === id
        ? 'active'
        : (target.type === 'injectable' && p.type === 'injectable' && p.status === 'active')
          ? 'paused'
          : p.status,
    }));
  }

  deactivateProtocol(id: string): void {
    const idx = this.data.protocols.findIndex(p => p.id === id);
    if (idx >= 0) {
      this.data.protocols[idx] = { ...this.data.protocols[idx], status: 'paused' };
    }
  }

  addDoseLog(log: DoseLog): void {
    this.data.doseLogs.push(log);
  }

  getDoseLogsForDate(date: string): DoseLog[] {
    return this.data.doseLogs.filter(l => l.timestamp.startsWith(date));
  }

  getDoseLogsForProtocol(protocolId: string): DoseLog[] {
    return this.data.doseLogs.filter(l => l.protocolId === protocolId);
  }

  getSettings(): DoseSettings {
    return { ...this.data.settings, injectionSites: [...this.data.settings.injectionSites] };
  }

  updateSettings(settings: Partial<DoseSettings>): void {
    this.data.settings = { ...this.data.settings, ...settings };
  }

  async save(): Promise<void> {
    await this.saveCallback(this.data);
  }

  /** Returns the store data for serialization. Do not mutate the returned object. */
  getData(): DoseStore { return this.data; }
}
```

**Note on the constructor:** The `type: 'injectable'` default is placed before `...p` so that if the saved protocol already has a `type` field it wins. The `supplementGroups` assignment after `...p` ensures old data without `supplementGroups` gets `[]`.

Wait — there's a duplicate key issue in the constructor. Replace with this cleaner version:

```typescript
      protocols: saved.protocols
        ? saved.protocols.map(p => ({
            type: 'injectable' as ProtocolType,
            ...p,
            supplementGroups: (p as Protocol).supplementGroups ?? ([] as SupplementGroup[]),
          }))
        : [],
```

`type: 'injectable'` before `...p` → old data (no type) gets `'injectable'`; new data with type wins via `...p`. `supplementGroups` after `...p` → old data gets `[]`; new data keeps its value.

### Step 5: Run tests to verify they pass

Run: `npm test -- --testPathPattern=store`

Expected: All store tests pass (existing 11 + new 5 = 16 store tests, 52 total).

If TypeScript complains about test fixtures in other test files missing `type`, also add `type: 'injectable'` to `protocol` in `tests/schedule.test.ts`.

### Step 6: Run full suite

Run: `npm test`

Expected: All tests pass.

### Step 7: Commit

```bash
git add src/types.ts src/store.ts tests/store.test.ts tests/schedule.test.ts
git commit -m "feat: add ProtocolType, getActiveProtocols(), deactivateProtocol(), type-aware activation"
```

---

## Task 2: Update Protocol Parser

**Files:**
- Modify: `src/protocol-parser.ts`
- Modify: `tests/protocol-parser.test.ts`

### Step 1: Write failing tests

Append to `tests/protocol-parser.test.ts` inside or after the existing `parseProtocol` describe block:

```typescript
describe('parseProtocol type field', () => {
  test('parses type: injectable from frontmatter', () => {
    const content = `---
name: "Test"
type: injectable
status: active
start_date: 2026-01-01
duration_weeks: 4
---
`;
    expect(parseProtocol(content, 'test.md')?.type).toBe('injectable');
  });

  test('parses type: supplement from frontmatter', () => {
    const content = `---
name: "Test"
type: supplement
status: active
start_date: 2026-01-01
duration_weeks: 4
---
`;
    expect(parseProtocol(content, 'test.md')?.type).toBe('supplement');
  });

  test('defaults type to injectable when missing', () => {
    const content = `---
name: "Test"
status: active
start_date: 2026-01-01
duration_weeks: 4
---
`;
    expect(parseProtocol(content, 'test.md')?.type).toBe('injectable');
  });

  test('defaults type to injectable when invalid', () => {
    const content = `---
name: "Test"
type: blah
status: active
start_date: 2026-01-01
duration_weeks: 4
---
`;
    expect(parseProtocol(content, 'test.md')?.type).toBe('injectable');
  });
});
```

### Step 2: Run tests to verify they fail

Run: `npm test -- --testPathPattern=protocol-parser`

Expected: FAIL — `type` field missing from returned Protocol.

### Step 3: Update `src/protocol-parser.ts`

Update the import on line 1 to include `ProtocolType`:
```typescript
import { Protocol, Compound, CompoundFrequency, FrequencyType, ProtocolStatus, ProtocolType, SupplementGroup, SupplementItem } from './types';
```

Update `parseProtocol()` to read `type` from frontmatter (add after the `rawStatus` line):
```typescript
  const VALID_TYPES: ProtocolType[] = ['injectable', 'supplement'];
  const rawType = frontmatter['type'];

  return {
    id: filePath,
    name: frontmatter['name'] ?? 'Unknown',
    type: VALID_TYPES.includes(rawType as ProtocolType) ? (rawType as ProtocolType) : 'injectable',
    status: VALID_STATUSES.includes(rawStatus as ProtocolStatus)
      ? (rawStatus as ProtocolStatus)
      : 'planned',
    startDate: frontmatter['start_date'] ?? '',
    durationWeeks: Number(frontmatter['duration_weeks']) || 0,
    compounds: parseCompounds(content),
    supplementGroups: parseSupplements(content),
    filePath,
  };
```

### Step 4: Run tests to verify they pass

Run: `npm test -- --testPathPattern=protocol-parser`

Expected: All protocol-parser tests pass (existing 18 + new 4 = 22 tests).

### Step 5: Run full suite

Run: `npm test`

Expected: All tests pass.

### Step 6: Commit

```bash
git add src/protocol-parser.ts tests/protocol-parser.test.ts
git commit -m "feat: parse protocol type field, default to injectable"
```

---

## Task 3: Update Planning Tab

**Files:**
- Modify: `src/views/planning-tab.ts`

UI-only change, no unit tests. Test manually in Obsidian.

### Step 1: Replace `src/views/planning-tab.ts` entirely

```typescript
import { Notice } from 'obsidian';
import DosePlugin from '../main';
import { Protocol } from '../types';

export function renderPlanningTab(el: HTMLElement, plugin: DosePlugin, refresh: () => void): void {
  const protocols = plugin.store.getProtocols();

  if (!protocols.length) {
    el.createEl('h3', { text: 'Protocols' });
    el.createEl('p', {
      text: 'No protocols found. Add protocol notes to your Protocols folder and click Refresh.',
    });
  } else {
    const injectables = protocols.filter(p => p.type === 'injectable');
    const supplements = protocols.filter(p => p.type === 'supplement');

    if (injectables.length > 0) {
      el.createEl('h3', { text: 'Injectable Protocols' });
      renderSection(el, injectables, plugin, refresh, false);
    }

    if (supplements.length > 0) {
      el.createEl('h3', { text: 'Supplement Protocols' });
      renderSection(el, supplements, plugin, refresh, true);
    }
  }

  const refreshBtn = el.createEl('button', { text: 'Refresh from vault', cls: 'dose-refresh-btn' });
  refreshBtn.addEventListener('click', async () => {
    await plugin.refreshProtocols();
    new Notice('Protocols refreshed');
    refresh();
  });
}

function renderSection(
  el: HTMLElement,
  protocols: Protocol[],
  plugin: DosePlugin,
  refresh: () => void,
  multiActive: boolean,
): void {
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
      renderProtocolItem(list, protocol, plugin, refresh, multiActive);
    }
  }
}

function renderProtocolItem(
  el: HTMLElement,
  protocol: Protocol,
  plugin: DosePlugin,
  refresh: () => void,
  multiActive: boolean,
): void {
  const item = el.createEl('li', { cls: 'dose-protocol-item' });
  const info = item.createDiv({ cls: 'dose-protocol-info' });
  info.createEl('strong', { text: protocol.name });

  if (protocol.compounds.length > 0) {
    info.createEl('span', {
      text: ` — ${protocol.durationWeeks}w, ${protocol.compounds.length} compounds`,
    });
    const compoundList = info.createEl('ul', { cls: 'dose-compound-list' });
    for (const compound of protocol.compounds) {
      compoundList.createEl('li', {
        text: `${compound.name}: ${compound.dose} (${compound.route})`,
      });
    }
  } else if (protocol.supplementGroups.length > 0) {
    const totalItems = protocol.supplementGroups.reduce((sum, g) => sum + g.items.length, 0);
    info.createEl('span', {
      text: ` — ${protocol.supplementGroups.length} groups, ${totalItems} items`,
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
    if (multiActive) {
      const deactivateBtn = actions.createEl('button', { text: 'Deactivate', cls: 'dose-skip-btn' });
      deactivateBtn.addEventListener('click', async () => {
        plugin.store.deactivateProtocol(protocol.id);
        await plugin.store.save();
        new Notice(`${protocol.name} deactivated`);
        refresh();
      });
    }
  }
}
```

### Step 2: Run full suite (TypeScript compile check)

Run: `npm test`

Expected: All tests pass.

### Step 3: Commit

```bash
git add src/views/planning-tab.ts
git commit -m "feat: split Planning tab into Injectable/Supplement sections with Deactivate button"
```

---

## Task 4: Update Today Tab

**Files:**
- Modify: `src/views/today-tab.ts`

UI-only change. Test manually in Obsidian.

### Step 1: Replace `src/views/today-tab.ts` entirely

```typescript
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
```

### Step 2: Add CSS for protocol label

Append to `styles.css`:

```css
.dose-supplement-protocol-label {
  font-weight: 700;
  font-size: 0.9em;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 16px 0 4px;
}
```

### Step 3: Run full suite

Run: `npm test`

Expected: All tests pass (TypeScript compiles cleanly).

### Step 4: Commit

```bash
git add src/views/today-tab.ts styles.css
git commit -m "feat: Today tab merges all active protocols, supplement groups labelled per protocol"
```

---

## Task 5: Update Dashboard Tab

**Files:**
- Modify: `src/views/dashboard-tab.ts`

UI-only change. Test manually in Obsidian.

### Step 1: Replace `src/views/dashboard-tab.ts` entirely

```typescript
import DosePlugin from '../main';
import { calculateAdherence, calculateStreak, getDueToday, getExpectedDoseCount } from '../schedule';
import { DoseLog, Protocol } from '../types';

export function renderDashboardTab(el: HTMLElement, plugin: DosePlugin): void {
  const activeProtocols = plugin.store.getActiveProtocols();

  if (!activeProtocols.length) {
    el.createEl('p', { text: 'No active protocol.' });
    return;
  }

  for (const protocol of activeProtocols) {
    const logs = plugin.store.getDoseLogsForProtocol(protocol.id);
    if (protocol.type === 'injectable') {
      renderInjectableCard(el, protocol, logs);
    } else {
      renderSupplementCard(el, protocol, logs);
    }
  }
}

function renderInjectableCard(el: HTMLElement, protocol: Protocol, logs: DoseLog[]): void {
  const startDate = new Date(protocol.startDate);
  const today = new Date();

  const card = el.createDiv({ cls: 'dose-protocol-card' });
  card.createEl('h3', { text: protocol.name });

  // Cycle progress
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksElapsed = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / msPerWeek));
  const weekNum = Math.min(weeksElapsed + 1, protocol.durationWeeks);
  const pct = Math.min(100, Math.round((weeksElapsed / protocol.durationWeeks) * 100));

  const progress = card.createDiv({ cls: 'dose-progress' });
  progress.createEl('p', { text: `Week ${weekNum} of ${protocol.durationWeeks} — ${pct}% complete` });
  const bar = progress.createDiv({ cls: 'dose-progress-bar' });
  bar.createDiv({ cls: 'dose-progress-fill', attr: { style: `width: ${pct}%` } });

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
    const startStr = startDate.toISOString().split('T')[0];
    const daysElapsed = Math.max(1, Math.floor(
      (today.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
    ) + 1);
    const supAdList = card.createEl('ul', { cls: 'dose-adherence-list' });
    for (const group of protocol.supplementGroups) {
      for (const item of group.items) {
        const taken = logs.filter(
          l => l.compoundName === item.name &&
               l.compoundType === 'supplement' &&
               l.status === 'taken' &&
               l.timestamp >= startStr,
        ).length;
        const supPct = Math.min(100, Math.round((taken / daysElapsed) * 100));
        const li = supAdList.createEl('li');
        li.createEl('span', { text: `${item.name} (${group.timeLabel}): ` });
        li.createEl('strong', { text: `${supPct}%` });
      }
    }
  }

  // Heatmap
  card.createEl('h4', { text: 'Last 30 Days' });
  renderHeatmap(card, protocol, logs, today);

  // History
  card.createEl('h4', { text: 'Dose History' });
  renderHistory(card, logs);
}

function renderSupplementCard(el: HTMLElement, protocol: Protocol, logs: DoseLog[]): void {
  const startDate = new Date(protocol.startDate);
  const today = new Date();
  const startStr = startDate.toISOString().split('T')[0];
  const daysElapsed = Math.max(1, Math.floor(
    (today.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
  ) + 1);

  const card = el.createDiv({ cls: 'dose-protocol-card' });
  card.createEl('h3', { text: protocol.name });

  card.createEl('h4', { text: 'Supplement Adherence' });
  const adList = card.createEl('ul', { cls: 'dose-adherence-list' });

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
```

### Step 2: Add CSS for protocol card

Append to `styles.css`:

```css
.dose-protocol-card {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--background-modifier-border);
}

.dose-protocol-card:last-child {
  border-bottom: none;
}
```

### Step 3: Run full suite

Run: `npm test`

Expected: All tests pass.

### Step 4: Commit

```bash
git add src/views/dashboard-tab.ts styles.css
git commit -m "feat: Dashboard renders one card per active protocol"
```

---

## Task 6: Update Vault Protocol Note, Rebuild, Reinstall

**Files:**
- Modify: `/Users/rglov/Documents/CRG/NOTES/Protocols/Dose Protocol v2026.02.md`
- Also modify: `/Users/rglov/Documents/CRG/Protocols/Dose Protocol v2026.02.md`
- Build + copy to vault

### Step 1: Add `type: injectable` to both protocol note copies

In both files, update the frontmatter to add `type: injectable` after the `name` line:

```markdown
---
name: "Stack Protocol v2026.02"
type: injectable
status: planned
start_date: 2026-02-01
duration_weeks: 26
---
```

### Step 2: Run full suite

Run: `npm test`

Expected: All tests pass.

### Step 3: Build

Run: `npm run build`

Expected: No errors.

### Step 4: Install

```bash
cp main.js /Users/rglov/Documents/CRG/.obsidian/plugins/dose/main.js
cp styles.css /Users/rglov/Documents/CRG/.obsidian/plugins/dose/styles.css
```

### Step 5: Commit

```bash
git add -A
git commit -m "feat: add type: injectable to vault protocol notes, rebuild and install"
```

### Step 6: Manual test in Obsidian

1. Disable/re-enable Dose plugin
2. Planning tab → Refresh Protocols → verify "Injectable Protocols" section shows Stack Protocol
3. Activate Stack Protocol → verify Injectables section in Today tab works
4. Create a new supplement-only protocol note in the protocols folder:

```markdown
---
name: "Test Supplement Stack"
type: supplement
status: planned
start_date: 2026-02-23
duration_weeks: 52
---

## Supplements
### Morning
- Test Vitamin: 1x
```

5. Refresh → "Supplement Protocols" section appears → Activate it
6. Today tab: both injectable and supplement sections appear; supplement stack is labelled
7. Dashboard: two cards, one per active protocol

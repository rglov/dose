# Supplements Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the Dose plugin to support oral supplements and vitamins as first-class protocol items with time-of-day grouping and single-tap logging.

**Architecture:** Add `SupplementItem`/`SupplementGroup` types, extend `Protocol` and `DoseLog`, add a `parseSupplements()` parser, render a supplement section in the Today tab after injectables, and count supplements in dashboard heatmap and adherence.

**Tech Stack:** TypeScript, Obsidian Plugin API, Jest + ts-jest, esbuild

---

## Context

- Plugin source: `src/` — types, parser, store, schedule, daily-note, views, modals
- Tests: `tests/` — `protocol-parser.test.ts`, `store.test.ts`, `daily-note.test.ts`, `schedule.test.ts`
- Obsidian mock: `tests/__mocks__/obsidian.ts`
- Build: `npm run build` → `main.js`
- Install path: `/Users/rglov/Documents/CRG/.obsidian/plugins/dose/`
- Vault protocol note: `/Users/rglov/Documents/CRG/Protocols/Dose Protocol v2026.02.md`

---

## Task 1: Update Types and Test Fixtures

**Files:**
- Modify: `src/types.ts`
- Modify: `src/store.ts` (constructor backward compat)
- Modify: `tests/store.test.ts` (add required fields to fixtures)
- Modify: `tests/daily-note.test.ts` (add required field to mockLog)
- Modify: `tests/schedule.test.ts` (add required field to inline logs and protocol)

### Step 1: Update `src/types.ts`

Replace the file content with:

```typescript
export type ProtocolStatus = 'active' | 'planned' | 'paused' | 'completed';
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

### Step 2: Update `src/store.ts` constructor for backward compatibility

Old `data.json` files have protocols without `supplementGroups` and logs without `compoundType`. Apply defaults when loading:

In the `Store` constructor, replace lines 26–29 with:

```typescript
    this.data = {
      version: saved.version ?? DEFAULT_STORE.version,
      protocols: saved.protocols
        ? saved.protocols.map(p => ({ supplementGroups: [] as SupplementGroup[], ...p }))
        : [],
      doseLogs: saved.doseLogs
        ? saved.doseLogs.map(l => ({ compoundType: 'injectable' as const, ...l }))
        : [],
      settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
    };
```

Add `SupplementGroup` to the import at line 1:
```typescript
import { DoseStore, Protocol, DoseLog, DoseSettings, SupplementGroup } from './types';
```

### Step 3: Update `tests/store.test.ts` — add `supplementGroups` to `mockProtocol`

Change `mockProtocol` to include `supplementGroups: []`:

```typescript
const mockProtocol: Protocol = {
  id: 'Protocols/test.md',
  name: 'Test Protocol',
  status: 'planned',
  startDate: '2026-02-22',
  durationWeeks: 12,
  compounds: [],
  supplementGroups: [],
  filePath: 'Protocols/test.md',
};
```

Change `mockLog` to include `compoundType: 'injectable'`:

```typescript
const mockLog: DoseLog = {
  id: 'log-1',
  protocolId: 'Protocols/test.md',
  compoundName: 'BPC-157',
  dose: '250mcg',
  site: 'Left abdomen',
  compoundType: 'injectable',
  timestamp: '2026-02-22T07:30:00.000Z',
  status: 'taken',
};
```

### Step 4: Update `tests/daily-note.test.ts` — add `compoundType` to `mockLog`

```typescript
const mockLog: DoseLog = {
  id: '1',
  protocolId: 'test.md',
  compoundName: 'BPC-157',
  dose: '250mcg',
  site: 'Left abdomen',
  compoundType: 'injectable',
  timestamp: '2026-02-22T07:30:00.000Z',
  status: 'taken',
};
```

### Step 5: Update `tests/schedule.test.ts` — add `supplementGroups` to `protocol`, `compoundType` to inline logs

Add `supplementGroups: []` to the `protocol` constant:

```typescript
const protocol: Protocol = {
  id: 'test.md',
  name: 'Test',
  status: 'active',
  startDate: '2026-02-22',
  durationWeeks: 12,
  compounds: [
    makeCompound('Daily Drug', 'daily'),
    makeCompound('Twice Daily', 'twice_daily'),
    makeCompound('Mon Thu Drug', 'weekly', [1, 4]),
  ],
  supplementGroups: [],
  filePath: 'test.md',
};
```

Add `compoundType: 'injectable'` to all inline `DoseLog` objects in the test file (lines 66, 84, 86):
```typescript
{ id: '1', protocolId: 'test.md', compoundName: 'Daily Drug', dose: '10mg', site: '', compoundType: 'injectable', timestamp: '2026-02-23T08:00:00Z', status: 'taken' },
{ id: '0', protocolId: 'test.md', compoundName: 'Daily Drug', dose: '10mg', site: '', compoundType: 'injectable', timestamp: '2026-02-01T08:00:00Z', status: 'taken' },
{ id: '1', protocolId: 'test.md', compoundName: 'Daily Drug', dose: '10mg', site: '', compoundType: 'injectable', timestamp: '2026-02-23T08:00:00Z', status: 'taken' },
```

### Step 6: Run existing tests to verify no regressions

Run: `npm test`

Expected: All tests pass (35 tests). No TypeScript errors.

### Step 7: Commit

```bash
git add src/types.ts src/store.ts tests/store.test.ts tests/daily-note.test.ts tests/schedule.test.ts
git commit -m "feat: add SupplementItem/SupplementGroup types and DoseLog.compoundType"
```

---

## Task 2: Add `parseSupplements()` with TDD

**Files:**
- Modify: `tests/protocol-parser.test.ts`
- Modify: `src/protocol-parser.ts`

### Step 1: Write failing tests in `tests/protocol-parser.test.ts`

Append after the existing `describe('parseProtocol', ...)` block:

```typescript
const SAMPLE_WITH_SUPPLEMENTS = `---
name: "Cycle A"
status: active
start_date: 2026-02-22
duration_weeks: 12
---

## Compounds
- BPC-157: 250mcg, subcutaneous, 2x/day (AM + PM)

## Supplements
### Morning (fasted)
- Nattovena: 3x
- Alpha GPC: 1x

### Breakfast 8AM
- Vascepa: 2x
- Cialis: 5mg
- Calcifediol

### Bedtime 9PM
- Magnesium Glycinate: 2x
- Apigenin: 1x`;

const SAMPLE_WITHOUT_SUPPLEMENTS = `---
name: "Cycle A"
status: active
start_date: 2026-02-22
duration_weeks: 12
---

## Compounds
- BPC-157: 250mcg, subcutaneous, 2x/day (AM + PM)`;

import { parseSupplements } from '../src/protocol-parser';

describe('parseSupplements', () => {
  test('returns empty array when no ## Supplements section', () => {
    expect(parseSupplements(SAMPLE_WITHOUT_SUPPLEMENTS)).toEqual([]);
  });

  test('returns correct number of groups', () => {
    const groups = parseSupplements(SAMPLE_WITH_SUPPLEMENTS);
    expect(groups).toHaveLength(3);
  });

  test('each group has correct timeLabel', () => {
    const groups = parseSupplements(SAMPLE_WITH_SUPPLEMENTS);
    expect(groups[0].timeLabel).toBe('Morning (fasted)');
    expect(groups[1].timeLabel).toBe('Breakfast 8AM');
    expect(groups[2].timeLabel).toBe('Bedtime 9PM');
  });

  test('parses items with dose', () => {
    const groups = parseSupplements(SAMPLE_WITH_SUPPLEMENTS);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].items[0]).toEqual({ name: 'Nattovena', dose: '3x' });
    expect(groups[0].items[1]).toEqual({ name: 'Alpha GPC', dose: '1x' });
  });

  test('parses item without dose as empty string', () => {
    const groups = parseSupplements(SAMPLE_WITH_SUPPLEMENTS);
    const calcifediol = groups[1].items.find(i => i.name === 'Calcifediol');
    expect(calcifediol).toEqual({ name: 'Calcifediol', dose: '' });
  });

  test('silently skips malformed lines (no "- " prefix)', () => {
    const content = `---
name: "Test"
status: active
start_date: 2026-01-01
duration_weeks: 4
---

## Supplements
### Morning
- Vitamin D: 5000IU
Not a valid line
* Also invalid`;
    const groups = parseSupplements(content);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].name).toBe('Vitamin D');
  });

  test('silently skips empty groups (no valid items)', () => {
    const content = `---
name: "Test"
status: active
start_date: 2026-01-01
duration_weeks: 4
---

## Supplements
### Empty Group
not a bullet
### Good Group
- Omega 3: 2x`;
    const groups = parseSupplements(content);
    expect(groups).toHaveLength(1);
    expect(groups[0].timeLabel).toBe('Good Group');
  });

  test('parseProtocol includes supplementGroups', () => {
    const result = parseProtocol(SAMPLE_WITH_SUPPLEMENTS, 'test.md');
    expect(result?.supplementGroups).toHaveLength(3);
  });

  test('parseProtocol supplementGroups defaults to [] when no section', () => {
    const result = parseProtocol(SAMPLE_WITHOUT_SUPPLEMENTS, 'test.md');
    expect(result?.supplementGroups).toEqual([]);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- tests/protocol-parser.test.ts`

Expected: FAIL — `parseSupplements` is not exported from `../src/protocol-parser`

### Step 3: Implement `parseSupplements()` and update `parseProtocol()` in `src/protocol-parser.ts`

Add the import for new types at the top (update line 1):
```typescript
import { Protocol, Compound, CompoundFrequency, FrequencyType, ProtocolStatus, SupplementGroup, SupplementItem } from './types';
```

Update `parseProtocol()` to include `supplementGroups` (replace lines 14–24):
```typescript
  return {
    id: filePath,
    name: frontmatter['name'] ?? 'Unknown',
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

Append at the end of `src/protocol-parser.ts` (after line 85):

```typescript
export function parseSupplements(content: string): SupplementGroup[] {
  const sectionMatch = content.match(/## Supplements\r?\n([\s\S]*?)(?:\n##|$)/);
  if (!sectionMatch) return [];

  const sectionBody = sectionMatch[1];
  const rawGroups = sectionBody.split(/(?=### )/);

  const groups: SupplementGroup[] = [];

  for (const chunk of rawGroups) {
    const lines = chunk.split(/\r?\n/);
    const headerLine = lines[0];
    if (!headerLine.startsWith('### ')) continue;

    const timeLabel = headerLine.slice(4).trim();
    const items: SupplementItem[] = [];

    for (const line of lines.slice(1)) {
      if (!line.startsWith('- ')) continue;
      const body = line.slice(2).trim();
      const colonIdx = body.indexOf(':');
      if (colonIdx >= 0) {
        items.push({
          name: body.slice(0, colonIdx).trim(),
          dose: body.slice(colonIdx + 1).trim(),
        });
      } else {
        items.push({ name: body, dose: '' });
      }
    }

    if (items.length > 0) {
      groups.push({ timeLabel, items });
    }
  }

  return groups;
}
```

### Step 4: Run tests to verify they pass

Run: `npm test -- tests/protocol-parser.test.ts`

Expected: All protocol-parser tests pass (existing 8 + new 9 = 17 tests).

### Step 5: Run full test suite to confirm no regressions

Run: `npm test`

Expected: All tests pass.

### Step 6: Commit

```bash
git add src/protocol-parser.ts tests/protocol-parser.test.ts
git commit -m "feat: add parseSupplements() with TDD"
```

---

## Task 3: Update Today Tab — Supplement Section

**Files:**
- Modify: `src/views/today-tab.ts`
- Modify: `styles.css`

This is UI code — no unit tests. Test manually in Obsidian after rebuild.

### Step 1: Update `src/views/today-tab.ts`

Add the supplement section after the existing injectables list. Replace the full file with:

```typescript
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
```

### Step 2: Add CSS for supplement group label in `styles.css`

Append after the `.dose-skip-btn` block (after line 65):

```css
.dose-supplement-group-label {
  font-weight: 600;
  color: var(--text-normal);
  margin: 12px 0 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.dose-supplement-time {
  color: var(--text-muted);
  font-size: 0.85em;
  margin-left: 4px;
}
```

### Step 3: Run full test suite

Run: `npm test`

Expected: All tests pass (TypeScript compiles, no regressions).

### Step 4: Commit

```bash
git add src/views/today-tab.ts styles.css
git commit -m "feat: render supplements section in Today tab with tap-to-log"
```

---

## Task 4: Update Dashboard — Supplement Heatmap and Adherence

**Files:**
- Modify: `src/views/dashboard-tab.ts`

UI code — no unit tests. Test manually in Obsidian.

### Step 1: Update `renderHeatmap` to count supplement items in expected total

In `src/views/dashboard-tab.ts`, find `renderHeatmap` (line 53). Replace the `totalExpected` line (line 67):

**Before:**
```typescript
    const totalExpected = dueCompounds.reduce((sum, c) => sum + getExpectedDoseCount(c), 0);
```

**After:**
```typescript
    const supplementCount = (protocol.supplementGroups ?? []).reduce(
      (sum, g) => sum + g.items.length, 0,
    );
    const totalExpected = dueCompounds.reduce((sum, c) => sum + getExpectedDoseCount(c), 0) + supplementCount;
```

### Step 2: Add supplement adherence section after injectable adherence

In `renderDashboardTab`, find the closing `}` of the injectable adherence block (after the `for...of` over `Object.entries(adherence)`, line ~42). Add the supplement adherence section after:

```typescript
  // Supplement adherence
  if (protocol.supplementGroups && protocol.supplementGroups.length > 0) {
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
```

The full updated `renderDashboardTab` function should look like this (replace lines 5–51):

```typescript
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
  if (protocol.supplementGroups && protocol.supplementGroups.length > 0) {
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
```

### Step 3: Run full test suite

Run: `npm test`

Expected: All tests pass.

### Step 4: Commit

```bash
git add src/views/dashboard-tab.ts
git commit -m "feat: include supplements in dashboard heatmap and adherence"
```

---

## Task 5: Update Vault Protocol Note, Rebuild, and Reinstall

**Files:**
- Modify: `/Users/rglov/Documents/CRG/Protocols/Dose Protocol v2026.02.md`
- Build: run `npm run build`
- Copy: `main.js`, `styles.css` → `/Users/rglov/Documents/CRG/.obsidian/plugins/dose/`

### Step 1: Add `## Supplements` section to the vault protocol note

The file is at `/Users/rglov/Documents/CRG/Protocols/Dose Protocol v2026.02.md`.

Replace the file with:

```markdown
---
name: "Protocol v2026.02"
status: planned
start_date: 2026-02-01
duration_weeks: 26
---

## Compounds
- Testosterone Cypionate: 60mg, IM, 3x/week (Mon + Wed + Fri)
- Retatrutide: 2mg, subcutaneous, 2x/week (Mon + Fri)
- Cagrilintide: 250mcg, subcutaneous, 2x/week (Mon + Fri)
- Tesamorelin: 2mg, subcutaneous, 5x/week (Mon + Tue + Wed + Thu + Fri)
- Ipamorelin/Tesamorelin Blend: 250/625mcg, subcutaneous, 3x/week (Mon + Wed + Fri)
- Creatine: 10g, oral, 1x/day

## Supplements
### Morning (fasted)
- Nattovena: 3x
- Alpha GPC: 1x

### Breakfast 8AM
- Vascepa: 2x
- Cialis: 5mg
- Calcifediol: 5mcg

### Bedtime 9PM
- Magnesium Glycinate: 2x
- Apigenin: 1x
```

### Step 2: Build the plugin

Run from the project root (`/Users/rglov/Documents/CRG/PROJECTS/Dose`):

```bash
npm run build
```

Expected: `main.js` generated with no errors.

### Step 3: Copy built files to Obsidian plugins folder

```bash
cp main.js /Users/rglov/Documents/CRG/.obsidian/plugins/dose/main.js
cp styles.css /Users/rglov/Documents/CRG/.obsidian/plugins/dose/styles.css
```

### Step 4: Commit

```bash
git add -A
git commit -m "feat: add supplements to vault protocol note and install updated plugin"
```

### Step 5: Manual test in Obsidian

1. In Obsidian, open Settings → Community Plugins → disable and re-enable Dose (to force reload)
2. Open the Dose panel (pill ribbon icon)
3. Go to **Planning** tab → Refresh Protocols → verify "Protocol v2026.02" shows up
4. Activate the protocol if not active
5. Go to **Today** tab:
   - Confirm "Injectables" section shows due compounds for today
   - Confirm "Supplements" section shows three groups: Morning (fasted), Breakfast 8AM, Bedtime 9PM
   - Tap ✓ on "Nattovena" → verify "Logged Nattovena" notice, item shows ✓ HH:MM
   - Confirm daily note updated with a blank Site column for Nattovena
6. Go to **Dashboard** tab:
   - Confirm "Supplement Adherence" section appears with items and percentages
   - Confirm heatmap cell for today is partial (some done, not all) rather than missed

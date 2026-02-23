# Dose Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a native Obsidian plugin that tracks peptide/supplement/medication protocols with a daily dose logger and adherence dashboard.

**Architecture:** Hybrid — canonical JSON store (`.obsidian/plugins/dose/data.json`) for fast dashboard queries + vault-integrated protocol notes (`Protocols/*.md`) and daily dose entries appended to existing daily notes (`Notes/YYYY-MM-DD.md`). Three-tab view pane: Today / Dashboard / Planning.

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild (bundler), Jest + ts-jest (unit tests)

---

### Task 1: Project Scaffold

**Files:**
- Create: `manifest.json`
- Create: `versions.json`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `jest.config.js`
- Create: `tests/__mocks__/obsidian.ts`
- Create: `.gitignore`

**Step 1: Initialize git and npm**

```bash
cd /Users/rglov/Documents/CRG/PROJECTS/Dose
git init
npm init -y
```

Expected: `package.json` created, `.git/` directory exists.

**Step 2: Install dependencies**

```bash
npm install --save-dev obsidian esbuild builtin-modules typescript tslib @types/node jest @types/jest ts-jest
```

Expected: `node_modules/` created, no errors.

**Step 3: Create `manifest.json`**

```json
{
  "id": "dose",
  "name": "Dose",
  "version": "1.0.0",
  "minAppVersion": "1.0.0",
  "description": "Track peptide, supplement, and medication protocols with adherence dashboards.",
  "author": "rglov",
  "authorUrl": "",
  "isDesktopOnly": false
}
```

**Step 4: Create `versions.json`**

```json
{
  "1.0.0": "1.0.0"
}
```

**Step 5: Update `package.json` scripts**

Replace the `"scripts"` section with:
```json
"scripts": {
  "dev": "node esbuild.config.mjs",
  "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
  "test": "jest"
}
```

**Step 6: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES6",
    "allowSyntheticDefaultImports": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "isolatedModules": true,
    "strictNullChecks": true,
    "lib": ["ES6", "DOM"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "tests"]
}
```

**Step 7: Create `esbuild.config.mjs`**

```javascript
import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
```

**Step 8: Create `jest.config.js`**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/tests/__mocks__/obsidian.ts',
  },
  testMatch: ['**/tests/**/*.test.ts'],
  tsconfig: {
    module: 'CommonJS',
  },
};
```

**Step 9: Create `tests/__mocks__/obsidian.ts`**

```typescript
export class Plugin {}
export class ItemView {
  contentEl: HTMLElement = document.createElement('div');
  constructor(public leaf: any) {}
}
export class Modal {
  contentEl: HTMLElement = document.createElement('div');
  constructor(public app: any) {}
  open() {}
  close() {}
}
export class Setting {
  constructor(public containerEl: HTMLElement) {}
  setName(_: string) { return this; }
  setDesc(_: string) { return this; }
  addText(_: any) { return this; }
  addTextArea(_: any) { return this; }
  addDropdown(_: any) { return this; }
  addButton(_: any) { return this; }
}
export class PluginSettingTab {
  containerEl: HTMLElement = document.createElement('div');
  constructor(public app: any, public plugin: any) {}
}
export class Notice {
  constructor(_: string) {}
}
export class TFile {}
export const normalizePath = (path: string) => path;
export const WorkspaceLeaf = class {};
```

**Step 10: Create `.gitignore`**

```
node_modules/
main.js
*.js.map
.DS_Store
```

**Step 11: Verify Jest works**

```bash
cd /Users/rglov/Documents/CRG/PROJECTS/Dose
npx jest --listTests
```

Expected: No errors (no tests yet, empty list is fine).

**Step 12: Commit**

```bash
git add manifest.json versions.json package.json package-lock.json tsconfig.json esbuild.config.mjs jest.config.js tests/__mocks__/obsidian.ts .gitignore
git commit -m "chore: scaffold Obsidian plugin project"
```

---

### Task 2: Core Types

**Files:**
- Create: `src/types.ts`

**Step 1: Create `src/types.ts`**

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

export interface Protocol {
  id: string;          // vault file path, used as unique key
  name: string;
  status: ProtocolStatus;
  startDate: string;   // YYYY-MM-DD
  durationWeeks: number;
  compounds: Compound[];
  filePath: string;
}

export interface DoseLog {
  id: string;
  protocolId: string;
  compoundName: string;
  dose: string;
  site: string;
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

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add core TypeScript types"
```

---

### Task 3: Protocol Parser

**Files:**
- Create: `src/protocol-parser.ts`
- Create: `tests/protocol-parser.test.ts`

Protocol note format (in `Protocols/`):
```markdown
---
name: "Cycle A"
status: active
start_date: 2026-02-22
duration_weeks: 12
---

## Compounds
- BPC-157: 250mcg, subcutaneous, 2x/day (AM + PM)
- TB-500: 5mg, subcutaneous, 2x/week (Mon + Thu)
- Semaglutide: 0.25mg, subcutaneous, 1x/week (Sun)
```

**Step 1: Write failing tests — `tests/protocol-parser.test.ts`**

```typescript
import { parseProtocol } from '../src/protocol-parser';

const SAMPLE = `---
name: "Cycle A"
status: active
start_date: 2026-02-22
duration_weeks: 12
---

## Compounds
- BPC-157: 250mcg, subcutaneous, 2x/day (AM + PM)
- TB-500: 5mg, subcutaneous, 2x/week (Mon + Thu)
- Semaglutide: 0.25mg, subcutaneous, 1x/week (Sun)`;

describe('parseProtocol', () => {
  test('parses frontmatter name and status', () => {
    const result = parseProtocol(SAMPLE, 'Protocols/Cycle A.md');
    expect(result?.name).toBe('Cycle A');
    expect(result?.status).toBe('active');
  });

  test('parses start date and duration', () => {
    const result = parseProtocol(SAMPLE, 'Protocols/Cycle A.md');
    expect(result?.startDate).toBe('2026-02-22');
    expect(result?.durationWeeks).toBe(12);
  });

  test('parses three compounds', () => {
    const result = parseProtocol(SAMPLE, 'Protocols/Cycle A.md');
    expect(result?.compounds).toHaveLength(3);
  });

  test('parses twice-daily compound', () => {
    const result = parseProtocol(SAMPLE, 'Protocols/Cycle A.md');
    const bpc = result?.compounds.find(c => c.name === 'BPC-157');
    expect(bpc?.dose).toBe('250mcg');
    expect(bpc?.route).toBe('subcutaneous');
    expect(bpc?.frequency.type).toBe('twice_daily');
  });

  test('parses weekly compound with specific days', () => {
    const result = parseProtocol(SAMPLE, 'Protocols/Cycle A.md');
    const tb = result?.compounds.find(c => c.name === 'TB-500');
    expect(tb?.frequency.type).toBe('weekly');
    expect(tb?.frequency.days).toEqual([1, 4]); // Mon=1, Thu=4
  });

  test('parses once-weekly compound', () => {
    const result = parseProtocol(SAMPLE, 'Protocols/Cycle A.md');
    const sema = result?.compounds.find(c => c.name === 'Semaglutide');
    expect(sema?.frequency.type).toBe('weekly');
    expect(sema?.frequency.days).toEqual([0]); // Sun=0
  });

  test('returns null for content without frontmatter', () => {
    expect(parseProtocol('No frontmatter here', 'test.md')).toBeNull();
  });

  test('stores filePath as id', () => {
    const result = parseProtocol(SAMPLE, 'Protocols/Cycle A.md');
    expect(result?.id).toBe('Protocols/Cycle A.md');
    expect(result?.filePath).toBe('Protocols/Cycle A.md');
  });
});
```

**Step 2: Run to verify they fail**

```bash
npx jest tests/protocol-parser.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../src/protocol-parser'`

**Step 3: Create `src/protocol-parser.ts`**

```typescript
import { Protocol, Compound, CompoundFrequency, FrequencyType, ProtocolStatus } from './types';

const DAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function parseProtocol(content: string, filePath: string): Protocol | null {
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) return null;

  return {
    id: filePath,
    name: frontmatter['name'] ?? 'Unknown',
    status: (frontmatter['status'] as ProtocolStatus) ?? 'planned',
    startDate: frontmatter['start_date'] ?? '',
    durationWeeks: Number(frontmatter['duration_weeks']) || 0,
    compounds: parseCompounds(content),
    filePath,
  };
}

function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^"(.*)"$/, '$1');
    result[key] = value;
  }
  return result;
}

function parseCompounds(content: string): Compound[] {
  const match = content.match(/## Compounds\n([\s\S]*?)(?:\n##|$)/);
  if (!match) return [];

  return match[1]
    .split('\n')
    .filter(l => l.startsWith('- '))
    .map(parseCompoundLine)
    .filter((c): c is Compound => c !== null);
}

function parseCompoundLine(line: string): Compound | null {
  // Format: "- Name: dose, route, frequency"
  const match = line.match(/^- (.+?):\s*(.+?),\s*(.+?),\s*(.+)$/);
  if (!match) return null;

  const [, name, dose, route, freqStr] = match;
  return {
    name: name.trim(),
    dose: dose.trim(),
    route: route.trim(),
    frequency: parseFrequency(freqStr.trim()),
  };
}

function parseFrequency(freqStr: string): CompoundFrequency {
  if (/\d+x\/day/i.test(freqStr)) {
    const count = parseInt(freqStr);
    return count >= 2 ? { type: 'twice_daily' } : { type: 'daily' };
  }

  if (/\d+x\/week/i.test(freqStr)) {
    const daysMatch = freqStr.match(/\(([^)]+)\)/);
    const days = daysMatch
      ? daysMatch[1]
          .split(/\s*\+\s*/)
          .map(d => DAY_MAP[d.trim()])
          .filter((d): d is number => d !== undefined)
      : [];
    return { type: 'weekly', days };
  }

  return { type: 'daily' };
}
```

**Step 4: Run tests to verify they pass**

```bash
npx jest tests/protocol-parser.test.ts --no-coverage
```

Expected: PASS — 8 tests pass

**Step 5: Commit**

```bash
git add src/protocol-parser.ts tests/protocol-parser.test.ts
git commit -m "feat: add protocol parser with tests"
```

---

### Task 4: Data Store

**Files:**
- Create: `src/store.ts`
- Create: `tests/store.test.ts`

**Step 1: Write failing tests — `tests/store.test.ts`**

```typescript
import { Store } from '../src/store';
import { Protocol, DoseLog } from '../src/types';

const mockProtocol: Protocol = {
  id: 'Protocols/test.md',
  name: 'Test Protocol',
  status: 'planned',
  startDate: '2026-02-22',
  durationWeeks: 12,
  compounds: [],
  filePath: 'Protocols/test.md',
};

const mockLog: DoseLog = {
  id: 'log-1',
  protocolId: 'Protocols/test.md',
  compoundName: 'BPC-157',
  dose: '250mcg',
  site: 'Left abdomen',
  timestamp: '2026-02-22T07:30:00.000Z',
  status: 'taken',
};

describe('Store', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store({}, async () => {});
  });

  test('upserts a new protocol', () => {
    store.upsertProtocol(mockProtocol);
    expect(store.getProtocols()).toHaveLength(1);
  });

  test('updates existing protocol without duplicating', () => {
    store.upsertProtocol(mockProtocol);
    store.upsertProtocol({ ...mockProtocol, name: 'Updated' });
    expect(store.getProtocols()).toHaveLength(1);
    expect(store.getProtocols()[0].name).toBe('Updated');
  });

  test('activates a protocol', () => {
    store.upsertProtocol({ ...mockProtocol, id: 'a.md', status: 'planned' });
    store.activateProtocol('a.md');
    expect(store.getProtocols().find(p => p.id === 'a.md')?.status).toBe('active');
  });

  test('pauses previously active protocol when activating another', () => {
    store.upsertProtocol({ ...mockProtocol, id: 'a.md', status: 'active' });
    store.upsertProtocol({ ...mockProtocol, id: 'b.md', status: 'planned' });
    store.activateProtocol('b.md');
    expect(store.getProtocols().find(p => p.id === 'a.md')?.status).toBe('paused');
    expect(store.getProtocols().find(p => p.id === 'b.md')?.status).toBe('active');
  });

  test('returns active protocol', () => {
    store.upsertProtocol({ ...mockProtocol, status: 'active' });
    expect(store.getActiveProtocol()?.id).toBe('Protocols/test.md');
  });

  test('returns undefined when no active protocol', () => {
    store.upsertProtocol(mockProtocol);
    expect(store.getActiveProtocol()).toBeUndefined();
  });

  test('adds and retrieves dose logs by date', () => {
    store.addDoseLog(mockLog);
    expect(store.getDoseLogsForDate('2026-02-22')).toHaveLength(1);
    expect(store.getDoseLogsForDate('2026-02-23')).toHaveLength(0);
  });

  test('retrieves dose logs by protocol', () => {
    store.addDoseLog(mockLog);
    store.addDoseLog({ ...mockLog, id: 'log-2', protocolId: 'other.md' });
    expect(store.getDoseLogsForProtocol('Protocols/test.md')).toHaveLength(1);
  });

  test('calls save callback with current data', async () => {
    let saved: any = null;
    const s = new Store({}, async (data) => { saved = data; });
    s.upsertProtocol(mockProtocol);
    await s.save();
    expect(saved?.protocols).toHaveLength(1);
  });

  test('uses default settings when none provided', () => {
    expect(store.getSettings().protocolsFolder).toBe('Protocols');
    expect(store.getSettings().dailyNotesFolder).toBe('Notes');
    expect(store.getSettings().injectionSites.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run to verify they fail**

```bash
npx jest tests/store.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../src/store'`

**Step 3: Create `src/store.ts`**

```typescript
import { DoseStore, Protocol, DoseLog, DoseSettings } from './types';

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
      ...DEFAULT_STORE,
      ...saved,
      settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
    };
    this.saveCallback = saveCallback;
  }

  getProtocols(): Protocol[] { return this.data.protocols; }

  getActiveProtocol(): Protocol | undefined {
    return this.data.protocols.find(p => p.status === 'active');
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
    this.data.protocols = this.data.protocols.map(p => ({
      ...p,
      status: p.id === id
        ? 'active'
        : p.status === 'active' ? 'paused' : p.status,
    }));
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

  getSettings(): DoseSettings { return this.data.settings; }

  updateSettings(settings: Partial<DoseSettings>): void {
    this.data.settings = { ...this.data.settings, ...settings };
  }

  async save(): Promise<void> {
    await this.saveCallback(this.data);
  }

  getData(): DoseStore { return this.data; }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx jest tests/store.test.ts --no-coverage
```

Expected: PASS — 10 tests pass

**Step 5: Commit**

```bash
git add src/store.ts tests/store.test.ts
git commit -m "feat: add data store with tests"
```

---

### Task 5: Schedule Calculator

**Files:**
- Create: `src/schedule.ts`
- Create: `tests/schedule.test.ts`

**Step 1: Write failing tests — `tests/schedule.test.ts`**

```typescript
import { getDueToday, getExpectedDoseCount, calculateAdherence, calculateStreak } from '../src/schedule';
import { Protocol, DoseLog, Compound } from '../src/types';

const makeCompound = (name: string, type: string, days?: number[]): Compound => ({
  name,
  dose: '10mg',
  route: 'oral',
  frequency: { type: type as any, days },
});

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
  filePath: 'test.md',
};

// 2026-02-23 is a Monday (getDay() === 1)
const MONDAY = new Date('2026-02-23T12:00:00Z');
// 2026-02-25 is a Wednesday (getDay() === 3)
const WEDNESDAY = new Date('2026-02-25T12:00:00Z');

describe('getDueToday', () => {
  test('daily compounds appear every day', () => {
    expect(getDueToday(protocol, MONDAY).some(c => c.name === 'Daily Drug')).toBe(true);
    expect(getDueToday(protocol, WEDNESDAY).some(c => c.name === 'Daily Drug')).toBe(true);
  });

  test('twice_daily compounds appear every day', () => {
    expect(getDueToday(protocol, MONDAY).some(c => c.name === 'Twice Daily')).toBe(true);
  });

  test('weekly compound appears on correct days', () => {
    expect(getDueToday(protocol, MONDAY).some(c => c.name === 'Mon Thu Drug')).toBe(true);
  });

  test('weekly compound does not appear on wrong days', () => {
    expect(getDueToday(protocol, WEDNESDAY).some(c => c.name === 'Mon Thu Drug')).toBe(false);
  });
});

describe('getExpectedDoseCount', () => {
  test('returns 2 for twice_daily', () => {
    expect(getExpectedDoseCount(makeCompound('x', 'twice_daily'))).toBe(2);
  });

  test('returns 1 for daily', () => {
    expect(getExpectedDoseCount(makeCompound('x', 'daily'))).toBe(1);
  });

  test('returns 1 for weekly', () => {
    expect(getExpectedDoseCount(makeCompound('x', 'weekly', [1]))).toBe(1);
  });
});

describe('calculateAdherence', () => {
  test('returns 100% when all doses taken', () => {
    const logs: DoseLog[] = [
      { id: '1', protocolId: 'test.md', compoundName: 'Daily Drug', dose: '10mg', site: '', timestamp: '2026-02-23T08:00:00Z', status: 'taken' },
    ];
    const start = new Date('2026-02-23');
    const end = new Date('2026-02-23');
    const result = calculateAdherence(protocol, logs, start, end);
    expect(result['Daily Drug']).toBe(100);
  });

  test('returns 0% when no doses taken', () => {
    const start = new Date('2026-02-23');
    const end = new Date('2026-02-23');
    const result = calculateAdherence(protocol, [], start, end);
    expect(result['Daily Drug']).toBe(0);
  });
});

describe('calculateStreak', () => {
  test('returns 0 with no logs', () => {
    expect(calculateStreak([], protocol)).toBe(0);
  });
});
```

**Step 2: Run to verify they fail**

```bash
npx jest tests/schedule.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../src/schedule'`

**Step 3: Create `src/schedule.ts`**

```typescript
import { Protocol, Compound, DoseLog } from './types';

export function getDueToday(protocol: Protocol, date: Date): Compound[] {
  const dayOfWeek = date.getDay();

  return protocol.compounds.filter(compound => {
    const { type, days } = compound.frequency;
    if (type === 'daily' || type === 'twice_daily') return true;
    if (type === 'weekly') return days?.includes(dayOfWeek) ?? false;
    return false;
  });
}

export function getExpectedDoseCount(compound: Compound): number {
  return compound.frequency.type === 'twice_daily' ? 2 : 1;
}

export function calculateAdherence(
  protocol: Protocol,
  logs: DoseLog[],
  startDate: Date,
  endDate: Date,
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const compound of protocol.compounds) {
    let expected = 0;
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (current <= end) {
      if (getDueToday(protocol, current).some(c => c.name === compound.name)) {
        expected += getExpectedDoseCount(compound);
      }
      current.setDate(current.getDate() + 1);
    }

    const taken = logs.filter(
      l => l.compoundName === compound.name && l.status === 'taken',
    ).length;

    result[compound.name] = expected > 0 ? Math.round((taken / expected) * 100) : 0;
  }

  return result;
}

export function calculateStreak(logs: DoseLog[], protocol: Protocol): number {
  if (!logs.length) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    const dueCompounds = getDueToday(protocol, checkDate);
    if (!dueCompounds.length) continue;

    const dayLogs = logs.filter(l => l.timestamp.startsWith(dateStr) && l.status === 'taken');

    const fullAdherence = dueCompounds.every(c => {
      const count = dayLogs.filter(l => l.compoundName === c.name).length;
      return count >= getExpectedDoseCount(c);
    });

    if (fullAdherence) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
```

**Step 4: Run tests to verify they pass**

```bash
npx jest tests/schedule.test.ts --no-coverage
```

Expected: PASS — 9 tests pass

**Step 5: Commit**

```bash
git add src/schedule.ts tests/schedule.test.ts
git commit -m "feat: add schedule calculator with tests"
```

---

### Task 6: Daily Note Writer

**Files:**
- Create: `src/daily-note.ts`
- Create: `tests/daily-note.test.ts`

**Step 1: Write failing tests — `tests/daily-note.test.ts`**

```typescript
import { buildDoseRow, appendDoseToContent } from '../src/daily-note';
import { DoseLog } from '../src/types';

const mockLog: DoseLog = {
  id: '1',
  protocolId: 'test.md',
  compoundName: 'BPC-157',
  dose: '250mcg',
  site: 'Left abdomen',
  timestamp: '2026-02-22T07:30:00.000Z',
  status: 'taken',
};

describe('buildDoseRow', () => {
  test('returns a pipe-delimited markdown table row', () => {
    const row = buildDoseRow(mockLog);
    expect(row.startsWith('|')).toBe(true);
    expect(row.endsWith('|')).toBe(true);
    expect(row).toContain('BPC-157');
    expect(row).toContain('250mcg');
    expect(row).toContain('Left abdomen');
  });
});

describe('appendDoseToContent', () => {
  test('creates Dose Log section when none exists', () => {
    const content = '# My Day\n\nSome notes.';
    const result = appendDoseToContent(content, '| 07:30 | BPC-157 | 250mcg | Left abdomen |');
    expect(result).toContain('## Dose Log');
    expect(result).toContain('BPC-157');
    expect(result).toContain('| Time | Compound | Dose | Site |');
  });

  test('appends row to existing Dose Log section', () => {
    const content = [
      '# My Day',
      '',
      '## Dose Log',
      '',
      '| Time | Compound | Dose | Site |',
      '|------|----------|------|------|',
      '| 07:30 | BPC-157 | 250mcg | Left abdomen |',
    ].join('\n');

    const result = appendDoseToContent(content, '| 19:45 | BPC-157 | 250mcg | Right abdomen |');
    expect(result).toContain('07:30');
    expect(result).toContain('19:45');
    // Only one Dose Log header
    expect(result.split('## Dose Log').length).toBe(2);
  });

  test('does not duplicate table header when appending', () => {
    const content = [
      '## Dose Log',
      '',
      '| Time | Compound | Dose | Site |',
      '|------|----------|------|------|',
      '| 07:30 | BPC-157 | 250mcg | Left abdomen |',
    ].join('\n');

    const result = appendDoseToContent(content, '| 19:45 | TB-500 | 5mg | Right thigh |');
    expect(result.split('| Time |').length).toBe(2); // only one header row
  });

  test('preserves content after Dose Log section', () => {
    const content = [
      '## Dose Log',
      '',
      '| Time | Compound | Dose | Site |',
      '|------|----------|------|------|',
      '| 07:30 | BPC-157 | 250mcg | Left abdomen |',
      '',
      '## Other Section',
      'Some other content',
    ].join('\n');

    const result = appendDoseToContent(content, '| 19:45 | TB-500 | 5mg | Right thigh |');
    expect(result).toContain('## Other Section');
  });
});
```

**Step 2: Run to verify they fail**

```bash
npx jest tests/daily-note.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../src/daily-note'`

**Step 3: Create `src/daily-note.ts`**

Note: `appendDoseToNote` requires the Obsidian `App` — it is excluded from unit tests and tested manually. Only the pure string functions are unit tested.

```typescript
import { DoseLog } from './types';

const DOSE_LOG_HEADER = '## Dose Log';
const TABLE_HEADER = '| Time | Compound | Dose | Site |';
const TABLE_DIVIDER = '|------|----------|------|------|';

export function buildDoseRow(log: DoseLog): string {
  const d = new Date(log.timestamp);
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  return `| ${time} | ${log.compoundName} | ${log.dose} | ${log.site} |`;
}

export function appendDoseToContent(content: string, row: string): string {
  const headerIdx = content.indexOf(DOSE_LOG_HEADER);

  if (headerIdx >= 0) {
    // Find insertion point: just before the next ## section or end of string
    const nextSection = content.indexOf('\n## ', headerIdx + DOSE_LOG_HEADER.length);
    const insertAt = nextSection >= 0 ? nextSection : content.length;
    const before = content.slice(0, insertAt).trimEnd();
    const after = content.slice(insertAt);
    return before + '\n' + row + (after ? '\n' + after : '\n');
  }

  // No section yet — create it
  const table = [DOSE_LOG_HEADER, '', TABLE_HEADER, TABLE_DIVIDER, row].join('\n');
  return content.trimEnd() + '\n\n' + table + '\n';
}

// Requires Obsidian App — not unit tested
export async function appendDoseToNote(
  app: import('obsidian').App,
  folderPath: string,
  log: DoseLog,
): Promise<void> {
  const { normalizePath, TFile } = await import('obsidian');
  const date = log.timestamp.split('T')[0];
  const notePath = normalizePath(`${folderPath}/${date}.md`);
  const row = buildDoseRow(log);

  const existing = app.vault.getAbstractFileByPath(notePath);

  if (!existing) {
    const table = [DOSE_LOG_HEADER, '', TABLE_HEADER, TABLE_DIVIDER, row].join('\n');
    await app.vault.create(notePath, table + '\n');
    return;
  }

  if (existing instanceof TFile) {
    const content = await app.vault.read(existing);
    const updated = appendDoseToContent(content, row);
    await app.vault.modify(existing, updated);
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx jest tests/daily-note.test.ts --no-coverage
```

Expected: PASS — 4 tests pass

**Step 5: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: PASS — all tests from Tasks 3–6 pass

**Step 6: Commit**

```bash
git add src/daily-note.ts tests/daily-note.test.ts
git commit -m "feat: add daily note writer with tests"
```

---

### Task 7: Plugin Entry Point

**Files:**
- Create: `src/main.ts`
- Create: `src/protocol-loader.ts`

No unit tests — this layer depends entirely on the Obsidian API. Verified by loading the plugin into Obsidian.

**Step 1: Create `src/protocol-loader.ts`**

```typescript
import { App, TFile, normalizePath } from 'obsidian';
import { Protocol } from './types';
import { parseProtocol } from './protocol-parser';

export async function loadProtocols(app: App, folder: string): Promise<Protocol[]> {
  const folderPath = normalizePath(folder);
  const files = app.vault.getMarkdownFiles().filter(
    f => f.path.startsWith(folderPath + '/'),
  );

  const protocols: Protocol[] = [];
  for (const file of files) {
    try {
      const content = await app.vault.read(file);
      const protocol = parseProtocol(content, file.path);
      if (protocol) protocols.push(protocol);
    } catch {
      console.warn(`[Dose] Failed to parse protocol: ${file.path}`);
    }
  }
  return protocols;
}
```

**Step 2: Create `src/main.ts`**

```typescript
import { Plugin, WorkspaceLeaf } from 'obsidian';
import { DoseView, VIEW_TYPE_DOSE } from './views/dose-view';
import { DoseSettingTab } from './settings';
import { Store } from './store';
import { DoseStore } from './types';
import { loadProtocols } from './protocol-loader';

export default class DosePlugin extends Plugin {
  store!: Store;

  async onload() {
    const saved = (await this.loadData()) as Partial<DoseStore> | null;
    this.store = new Store(saved ?? {}, async (data) => {
      await this.saveData(data);
    });

    this.registerView(VIEW_TYPE_DOSE, (leaf) => new DoseView(leaf, this));

    this.addRibbonIcon('pill', 'Dose', () => this.activateView());

    this.addSettingTab(new DoseSettingTab(this.app, this));

    this.addCommand({
      id: 'open-dose',
      name: 'Open Dose tracker',
      callback: () => this.activateView(),
    });

    await this.refreshProtocols();
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_DOSE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE_DOSE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async refreshProtocols(): Promise<void> {
    const folder = this.store.getSettings().protocolsFolder;
    const protocols = await loadProtocols(this.app, folder);
    for (const protocol of protocols) {
      this.store.upsertProtocol(protocol);
    }
    await this.store.save();
  }

  onunload(): void {}
}
```

**Step 3: Build to verify TypeScript compiles (types only — esbuild will complain about missing view files)**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

Expected: Errors only about missing `./views/dose-view` and `./settings` — that's fine, those come next.

**Step 4: Commit**

```bash
git add src/main.ts src/protocol-loader.ts
git commit -m "feat: add plugin entry point and protocol loader"
```

---

### Task 8: Dose View Shell (Tab Container)

**Files:**
- Create: `src/views/dose-view.ts`

**Step 1: Create `src/views/dose-view.ts`**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/views/dose-view.ts
git commit -m "feat: add dose view tab shell"
```

---

### Task 9: Today Tab + Log Dose Modal

**Files:**
- Create: `src/views/today-tab.ts`
- Create: `src/modals/log-dose-modal.ts`

**Step 1: Create `src/modals/log-dose-modal.ts`**

```typescript
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
```

**Step 2: Create `src/views/today-tab.ts`**

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
  const dateStr = today.toISOString().split('T')[0];
  const dueCompounds = getDueToday(protocol, today);
  const todayLogs = plugin.store.getDoseLogsForDate(dateStr);

  el.createEl('h3', { text: `Today — ${dateStr}` });

  if (!dueCompounds.length) {
    el.createEl('p', { text: 'Nothing scheduled today.' });
    return;
  }

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
            await appendDoseToNote(plugin.app, settings.dailyNotesFolder, log);
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
```

**Step 3: Commit**

```bash
git add src/views/today-tab.ts src/modals/log-dose-modal.ts
git commit -m "feat: add Today tab and Log Dose modal"
```

---

### Task 10: Dashboard Tab

**Files:**
- Create: `src/views/dashboard-tab.ts`

**Step 1: Create `src/views/dashboard-tab.ts`**

```typescript
import DosePlugin from '../main';
import { calculateAdherence, calculateStreak, getDueToday } from '../schedule';
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

  // Adherence per compound
  el.createEl('h4', { text: 'Adherence' });
  const adherence = calculateAdherence(protocol, logs, startDate, today);
  const adList = el.createEl('ul', { cls: 'dose-adherence-list' });
  for (const [name, adherencePct] of Object.entries(adherence)) {
    const item = adList.createEl('li');
    item.createEl('span', { text: `${name}: ` });
    item.createEl('strong', { text: `${adherencePct}%` });
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
    const dateStr = date.toISOString().split('T')[0];

    const dueCompounds = getDueToday(protocol, date);
    const dayLogs = logs.filter(l => l.timestamp.startsWith(dateStr) && l.status === 'taken');

    let cls = 'dose-heatmap-cell';
    if (!dueCompounds.length) cls += ' none';
    else if (dayLogs.length === 0) cls += ' missed';
    else if (dayLogs.length < dueCompounds.length) cls += ' partial';
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

**Step 2: Commit**

```bash
git add src/views/dashboard-tab.ts
git commit -m "feat: add Dashboard tab"
```

---

### Task 11: Planning Tab

**Files:**
- Create: `src/views/planning-tab.ts`

**Step 1: Create `src/views/planning-tab.ts`**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/views/planning-tab.ts
git commit -m "feat: add Planning tab"
```

---

### Task 12: Settings Tab + Styles

**Files:**
- Create: `src/settings.ts`
- Create: `styles.css`

**Step 1: Create `src/settings.ts`**

```typescript
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
```

**Step 2: Create `styles.css`**

```css
/* Tab bar */
.dose-tab-bar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.dose-tab-btn {
  padding: 4px 14px;
  border-radius: 4px;
  border: 1px solid var(--background-modifier-border);
  cursor: pointer;
  background: transparent;
  color: var(--text-muted);
}

.dose-tab-btn.active {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
}

.dose-tab-content {
  padding: 12px;
  overflow-y: auto;
}

/* Today tab */
.dose-today-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.dose-today-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--background-modifier-border);
}

.dose-done {
  color: var(--text-muted);
  text-decoration: line-through;
}

.dose-log-btn {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 4px;
  padding: 3px 10px;
  cursor: pointer;
}

.dose-skip-btn {
  background: transparent;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 3px 10px;
  cursor: pointer;
  color: var(--text-muted);
}

/* Dashboard */
.dose-progress {
  margin-bottom: 12px;
}

.dose-progress-bar {
  height: 8px;
  background: var(--background-modifier-border);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 4px;
}

.dose-progress-fill {
  height: 100%;
  background: var(--interactive-accent);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.dose-adherence-list {
  list-style: none;
  padding: 0;
}

.dose-adherence-list li {
  padding: 4px 0;
}

.dose-heatmap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 8px 0 16px;
}

.dose-heatmap-cell {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  cursor: default;
}

.dose-heatmap-cell.full    { background: var(--color-green); }
.dose-heatmap-cell.partial { background: var(--color-yellow); }
.dose-heatmap-cell.missed  { background: var(--color-red); }
.dose-heatmap-cell.none    { background: var(--background-modifier-border); }

.dose-history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85em;
}

.dose-history-table th,
.dose-history-table td {
  padding: 4px 8px;
  text-align: left;
  border-bottom: 1px solid var(--background-modifier-border);
}

/* Planning tab */
.dose-protocol-list {
  list-style: none;
  padding: 0;
}

.dose-protocol-item {
  padding: 10px 0;
  border-bottom: 1px solid var(--background-modifier-border);
}

.dose-protocol-info {
  margin-bottom: 6px;
}

.dose-compound-list {
  font-size: 0.85em;
  color: var(--text-muted);
  margin: 4px 0 0 16px;
}

.dose-protocol-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.dose-active-badge {
  color: var(--color-green);
  font-weight: 500;
}

.dose-refresh-btn {
  margin-top: 16px;
  padding: 6px 14px;
  border-radius: 4px;
  border: 1px solid var(--background-modifier-border);
  cursor: pointer;
}
```

**Step 3: Build the plugin**

```bash
npm run build
```

Expected: `main.js` created in project root, no TypeScript errors.

**Step 4: Run full test suite one final time**

```bash
npx jest --no-coverage
```

Expected: PASS — all unit tests pass

**Step 5: Commit**

```bash
git add src/settings.ts styles.css
git commit -m "feat: add settings tab and styles"
```

---

### Task 13: Manual Testing in Obsidian

**Setup steps (do once):**

1. Create a test vault in Obsidian (or use your real vault in a safe way)
2. Copy `main.js`, `manifest.json`, `styles.css` into `.obsidian/plugins/dose/`
3. Enable the plugin in Settings → Community Plugins → Dose
4. Create `Protocols/Cycle A.md` with the format from Task 3
5. Ensure `Notes/` folder exists (for daily notes)

**Verification checklist:**

- [ ] Ribbon icon appears and opens the Dose pane
- [ ] Today tab shows compounds due today for the active protocol
- [ ] Log Dose modal opens with correct defaults (dose pre-filled, time = now)
- [ ] After logging, a row appears in `Notes/YYYY-MM-DD.md`
- [ ] After logging, compound shows checkmark in Today tab
- [ ] Dashboard shows cycle week, adherence %, and heatmap cells
- [ ] Planning tab lists all protocols by status
- [ ] Activating a planned protocol pauses the previously active one
- [ ] Settings → Dose lets you change folders and injection sites
- [ ] Refresh button in Planning re-reads vault protocol notes

**Step 1: Install to test vault and run through checklist above**

Manual — no commands.

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat: complete Dose plugin v1.0"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Project scaffold (git, npm, TypeScript, esbuild, Jest) |
| 2 | Core TypeScript types |
| 3 | Protocol parser + unit tests |
| 4 | JSON data store + unit tests |
| 5 | Schedule calculator + unit tests |
| 6 | Daily note writer + unit tests |
| 7 | Plugin entry point + protocol loader |
| 8 | Dose view tab shell |
| 9 | Today tab + Log Dose modal |
| 10 | Dashboard tab |
| 11 | Planning tab |
| 12 | Settings tab + CSS |
| 13 | Manual testing in Obsidian |

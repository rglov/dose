# Multi-Protocol & Protocol Types — Design Document

**Date:** 2026-02-23
**Status:** Approved

## Overview

Allow multiple protocols to be active simultaneously by introducing a `type` field (`injectable` | `supplement`). Injectable protocols remain single-active (activating one pauses the other). Supplement protocols can all be active at the same time. The Today tab merges all active protocols; the Dashboard shows a separate card per active protocol.

---

## Data Model

### Updated `Protocol` (`src/types.ts`)

Add `type: 'injectable' | 'supplement'` field.

```typescript
export type ProtocolType = 'injectable' | 'supplement';

export interface Protocol {
  id: string;
  name: string;
  type: ProtocolType;        // new
  status: ProtocolStatus;
  startDate: string;
  durationWeeks: number;
  compounds: Compound[];
  supplementGroups: SupplementGroup[];
  filePath: string;
}
```

Backward compatibility: protocols missing `type` default to `'injectable'`.

### Updated `Store` (`src/store.ts`)

- `getActiveProtocol()` — kept for backward compat, returns first active injectable
- `getActiveProtocols(): Protocol[]` — returns all active protocols (any type)
- `activateProtocol(id)`:
  - If target is `injectable`: pause all other active injectable protocols (existing behavior)
  - If target is `supplement`: just set to `active`, do not touch other protocols
- `deactivateProtocol(id)`: set protocol status to `'paused'`

---

## Protocol Note Format

Same markdown format as today. `type` is added to frontmatter. Omitting `type` defaults to `injectable`.

**Injectable protocol:**
```markdown
---
name: "Stack Protocol v2026.02"
type: injectable
status: active
start_date: 2026-02-01
duration_weeks: 26
---

## Compounds
- Testosterone Cypionate: 60mg, IM, 3x/week (Mon + Wed + Fri)
...

## Supplements
### Morning (fasted)
- Nattovena: 3x
...
```

**Supplement-only protocol:**
```markdown
---
name: "Morning Stack v1"
type: supplement
status: planned
start_date: 2026-02-23
duration_weeks: 26
---

## Supplements
### Morning (fasted)
- Nattovena: 3x
- SFI CDP Choline: 1x
```

No `## Compounds` section required for supplement protocols.

---

## Protocol Parser Changes (`src/protocol-parser.ts`)

- Read `type` from frontmatter: `'injectable' | 'supplement'`
- Validate against `VALID_TYPES: ProtocolType[]`; default to `'injectable'` if missing or invalid

---

## Planning Tab (`src/views/planning-tab.ts`)

Two labeled sections:

**Injectable Protocols**
- Lists all protocols with `type === 'injectable'`
- Activate button: activates selected, pauses currently active injectable
- One active at a time (existing behavior)

**Supplement Protocols**
- Lists all protocols with `type === 'supplement'`
- Activate / Deactivate toggle per protocol
- Multiple can be active simultaneously
- No pausing of other protocols on activate

Both sections show: name, status badge, compound/supplement list summary, start date.

---

## Today Tab (`src/views/today-tab.ts`)

Merges all active protocols:

**Injectables section** — compounds from all active injectable protocols (in practice one).

**Supplements section** — supplement groups from all active protocols:
- If only one supplement protocol active: render groups as today (no label)
- If two or more supplement protocols active: render protocol name as a sub-heading above each protocol's groups

---

## Dashboard (`src/views/dashboard-tab.ts`)

One card per active protocol, stacked vertically.

**Injectable protocol card:** cycle progress bar, streak, injectable adherence per compound, 30-day heatmap.

**Supplement protocol card:** supplement adherence per item (grouped by time label). No streak or heatmap.

Each card is headed by the protocol name.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `type` missing from frontmatter | Defaults to `'injectable'` |
| `type` invalid value | Defaults to `'injectable'` |
| Supplement protocol has `## Compounds` | Compounds parsed and tracked normally |
| Injectable protocol has no `## Supplements` | `supplementGroups: []`, no supplement section |
| No active protocols | Today tab: "No active protocol" message |

---

## Testing

- Unit: `parseProtocol` reads `type` field correctly, defaults to `'injectable'`
- Unit: `Store.activateProtocol` — injectable activation pauses other injectable, not supplements
- Unit: `Store.activateProtocol` — supplement activation does not affect other protocols
- Unit: `Store.deactivateProtocol` — sets status to `'paused'`
- Unit: `Store.getActiveProtocols` — returns all active protocols regardless of type
- Manual: Planning tab shows two sections; activating supplement doesn't deactivate injectable
- Manual: Today tab merges compounds and supplements from multiple active protocols
- Manual: Dashboard shows separate cards per active protocol

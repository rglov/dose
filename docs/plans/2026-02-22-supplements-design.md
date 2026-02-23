# Supplements & Oral Vitamins — Design Document

**Date:** 2026-02-22
**Status:** Approved

## Overview

Extend the Dose plugin to support oral supplements and vitamins as first-class protocol items alongside injectables. Supplements are tracked individually, logged with a single tap (no site picker), and displayed in the Today tab grouped under time-of-day headers.

---

## Data Model

### New types (`src/types.ts`)

```typescript
export interface SupplementItem {
  name: string;
  dose: string;  // e.g. "3x", "5mg", "" if not specified
}

export interface SupplementGroup {
  timeLabel: string;   // e.g. "Morning (fasted)", "Breakfast 8AM"
  items: SupplementItem[];
}
```

### Updated `Protocol`

Add `supplementGroups: SupplementGroup[]` — empty array if no supplements defined.

### Updated `DoseLog`

Add `compoundType: 'injectable' | 'supplement'` field to distinguish log entries. `site` is `''` for supplements.

---

## Protocol Note Format

`## Supplements` section with `###` subsections per time group. Each item is a bullet `- Name: dose` or `- Name` (dose optional).

```markdown
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

---

## Protocol Parser Changes (`src/protocol-parser.ts`)

- Add `parseSupplements(content)` function
- Extracts `## Supplements` section
- Splits on `### ` headings to get time groups
- Parses each `- Name: dose` or `- Name` bullet into `SupplementItem`
- Returns `SupplementGroup[]`
- Malformed lines (no `- ` prefix) silently skipped
- Empty groups silently skipped

---

## Today Tab UI (`src/views/today-tab.ts`)

Two sections rendered in order:

**1. Injectables** — existing behavior unchanged.

**2. Supplements** — one sub-section per `SupplementGroup`, in protocol order:
- Time label rendered as a section divider header
- Each `SupplementItem` shows name, dose, and a ✓ button
- Tapping ✓ immediately logs (no modal): records timestamp, `compoundType: 'supplement'`, `site: ''`
- Already-logged items show checkmark + time logged
- No Skip button for supplements

---

## Logging

Single-tap logs a `DoseLog` with:
- `compoundName`: supplement name
- `dose`: from `SupplementItem.dose`
- `site`: `''`
- `compoundType`: `'supplement'`
- `timestamp`: `new Date().toISOString()`
- `status`: `'taken'`

Appends a row to the daily note table with `Site` column blank.

---

## Dashboard

- Supplement logs appear in adherence % per compound alongside injectables
- Heatmap counts supplement doses toward daily total
- History table: `Site` column blank for supplement rows

---

## Daily Note Output

```markdown
| Time  | Compound          | Dose | Site       |
|-------|-------------------|------|------------|
| 07:30 | Testosterone Cyp  | 60mg | Left glute |
| 08:05 | Nattovena         | 3x   |            |
| 08:06 | Alpha GPC         | 1x   |            |
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `## Supplements` section absent | `supplementGroups: []`, no change to Today tab |
| `###` group with no items | Silently skipped |
| Malformed supplement line | Silently skipped |
| Supplement logged twice | Allowed — both entries recorded, UI shows count |

---

## Testing

- Unit tests: `parseSupplements()` — correct group/item extraction, empty groups skipped, missing section returns `[]`
- Unit test: `DoseLog` with `compoundType: 'supplement'` and `site: ''` appends correct daily note row
- Manual: Today tab shows time-grouped supplements; tap logs immediately; daily note updated

# Dose Plugin — Design Document

**Date:** 2026-02-22
**Status:** Approved

## Overview

A native Obsidian plugin for tracking peptide, supplement, and medication protocols. Provides an easy-to-use daily dose tracker and adherence dashboards, integrated with an existing Peptide Library and a new Protocols folder.

---

## Architecture

Three layers:

1. **Data layer** — Canonical JSON store at `.obsidian/plugins/dose/data.json`. Holds all protocols, compounds, and dose logs. Powers the dashboard with fast, reliable queries.
2. **Vault layer** — Protocol notes in `Protocols/` as structured markdown. Daily dose entries appended to existing daily notes at `Notes/YYYY-MM-DD.md`. Peptide Library at `Notes/Peptide Library/` read-only.
3. **UI layer** — Dedicated plugin view pane (ribbon icon) with three tabs: Today, Dashboard, Planning.

**Data flow:**
- On startup: plugin reads `Protocols/` → populates JSON store
- Logging a dose: user fills modal → saves to JSON → appends row to today's daily note
- Dashboard: reads entirely from JSON (no note parsing at query time)

---

## Vault Structure & Note Formats

### Protocol Notes (`Protocols/`)

One note per protocol, frontmatter + human-readable body:

```markdown
---
name: "Cycle A"
status: active  # active | planned | paused | completed
start_date: 2026-02-22
duration_weeks: 12
---

## Compounds
- BPC-157: 250mcg, subcutaneous, 2x/day (AM + PM)
- TB-500: 5mg, subcutaneous, 2x/week (Mon + Thu)
- Semaglutide: 0.25mg, subcutaneous, 1x/week (Sun)
```

### Peptide Library (`Notes/Peptide Library/`)

One note per compound. Plugin reads compound descriptions and typical dosing ranges for display in UI. Never written to by the plugin.

### Daily Notes (`Notes/YYYY-MM-DD.md`)

Plugin appends a Dose Log section to the existing daily note after each logged dose. If the note doesn't exist, the plugin creates it.

```markdown
## Dose Log

| Time  | Compound  | Dose   | Site          |
|-------|-----------|--------|---------------|
| 07:30 | BPC-157   | 250mcg | Left abdomen  |
| 19:45 | BPC-157   | 250mcg | Right abdomen |
```

Each logged dose appends a new row. The section is created if not already present.

---

## UI & Logging Flow

**Ribbon icon** opens the Dose view pane with three tabs:

### Today Tab
- Lists all compounds due today per the active protocol schedule
- **Log Dose** button per compound opens a modal:
  - Compound name (pre-filled)
  - Dose (pre-filled from protocol, editable)
  - Injection site (dropdown: left/right abdomen, left/right thigh, left/right delt — customizable)
  - Time (defaults to now, editable)
  - Confirm button
- Logged doses show a checkmark; doses can also be marked as skipped

### Dashboard Tab
- **Cycle progress** — week X of 12, overall % complete
- **Adherence % per compound** — taken vs. scheduled doses
- **Current streak** — consecutive days with full adherence
- **Heatmap** — calendar view color-coded by adherence (full / partial / missed)
- **Per-compound history** — expandable list of all logged doses with sites and times

### Planning Tab
- List of all protocols in `Protocols/` grouped by status (active, planned, completed)
- Create new protocol or clone an existing one as a starting point
- Edit compounds, doses, frequencies, duration, start date
- Set protocol status
- Activate a planned protocol (automatically pauses any currently active one)
- Read-only summary view of any protocol

---

## Error Handling

| Scenario | Behavior |
|---|---|
| No active protocol | Today tab shows empty state with prompt to activate one in Planning |
| Malformed protocol note | Warning surfaced with filename; note skipped, plugin continues |
| Daily note doesn't exist | Plugin creates `Notes/YYYY-MM-DD.md` before appending |
| Extra dose (outside schedule) | Allowed; flagged as "extra dose" in dashboard |
| Multiple active protocols attempted | Activating a protocol auto-pauses the current active one |

---

## Tech Stack

- **Language:** TypeScript
- **Framework:** Native Obsidian Plugin API
- **Data storage:** JSON (`.obsidian/plugins/dose/data.json`)
- **UI:** Obsidian ItemView + native components

---

## Testing

- Unit tests for core logic: protocol parsing, schedule calculation, adherence %, streak logic, daily note appending
- Manual testing against a test vault with sample protocol and peptide library notes
- No UI automation (impractical with Obsidian plugin infra)

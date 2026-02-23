import { parseProtocol, parseSupplements } from '../src/protocol-parser';

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

  test('stops at next ## section boundary', () => {
    const content = `---
name: "Test"
status: active
start_date: 2026-01-01
duration_weeks: 4
---

## Supplements
### Morning
- Vitamin D: 5000IU

## Notes
Some notes here`;
    const groups = parseSupplements(content);
    expect(groups).toHaveLength(1);
    expect(groups[0].timeLabel).toBe('Morning');
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].name).toBe('Vitamin D');
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

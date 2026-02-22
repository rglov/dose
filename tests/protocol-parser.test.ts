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

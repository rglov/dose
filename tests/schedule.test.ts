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
  supplementGroups: [],
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
      { id: '1', protocolId: 'test.md', compoundName: 'Daily Drug', dose: '10mg', site: '', compoundType: 'injectable', timestamp: '2026-02-23T08:00:00Z', status: 'taken' },
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

  test('ignores logs outside the date range', () => {
    const logs: DoseLog[] = [
      // This log is BEFORE the window
      { id: '0', protocolId: 'test.md', compoundName: 'Daily Drug', dose: '10mg', site: '', compoundType: 'injectable', timestamp: '2026-02-01T08:00:00Z', status: 'taken' },
      // This log is IN the window
      { id: '1', protocolId: 'test.md', compoundName: 'Daily Drug', dose: '10mg', site: '', compoundType: 'injectable', timestamp: '2026-02-23T08:00:00Z', status: 'taken' },
    ];
    const start = new Date('2026-02-23T00:00:00Z');
    const end = new Date('2026-02-23T23:59:59Z');
    const result = calculateAdherence(protocol, logs, start, end);
    expect(result['Daily Drug']).toBe(100); // only 1 expected, only 1 in window
  });
});

describe('calculateStreak', () => {
  test('returns 0 with no logs', () => {
    expect(calculateStreak([], protocol)).toBe(0);
  });

  test('accepts optional today parameter for testability', () => {
    // Should not throw when today is provided
    expect(() => calculateStreak([], protocol, new Date('2026-02-23'))).not.toThrow();
  });
});

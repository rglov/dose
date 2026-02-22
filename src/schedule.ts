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

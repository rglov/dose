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

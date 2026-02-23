import { Protocol, Compound, CompoundFrequency, FrequencyType, ProtocolStatus, ProtocolType, SupplementGroup, SupplementItem } from './types';

const DAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function parseProtocol(content: string, filePath: string): Protocol | null {
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) return null;

  const VALID_STATUSES: ProtocolStatus[] = ['active', 'planned', 'paused', 'completed'];
  const rawStatus = frontmatter['status'];
  const VALID_TYPES: ProtocolType[] = ['injectable', 'supplement'];
  const rawType = frontmatter['type'];

  return {
    id: filePath,
    name: frontmatter['name'] ?? 'Unknown',
    type: VALID_TYPES.includes(rawType as ProtocolType) ? (rawType as ProtocolType) : 'injectable',
    status: VALID_STATUSES.includes(rawStatus as ProtocolStatus)
      ? (rawStatus as ProtocolStatus)
      : 'planned',
    startDate: frontmatter['start_date'] ?? '',
    durationWeeks: Number(frontmatter['duration_weeks']) || 0,
    compounds: parseCompounds(content),
    supplementGroups: parseSupplements(content),
    filePath,
  };
}

function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const result: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
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

export function parseSupplements(content: string): SupplementGroup[] {
  const sectionMatch = content.match(/## Supplements\r?\n([\s\S]*?)(?:\r?\n## [^#]|$)/);
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

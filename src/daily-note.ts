import { App, TFile, normalizePath } from 'obsidian';
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

// Requires Obsidian App — not unit tested, tested manually
export async function appendDoseToNote(
  app: App,
  folderPath: string,
  log: DoseLog,
): Promise<void> {
  const date = log.timestamp.split('T')[0];
  const notePath = normalizePath(`${folderPath}/${date}.md`);
  const row = buildDoseRow(log);

  const existing = app.vault.getAbstractFileByPath(notePath);

  if (!existing) {
    const table = [DOSE_LOG_HEADER, '', TABLE_HEADER, TABLE_DIVIDER, row].join('\n');
    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      await app.vault.createFolder(folderPath);
    }
    await app.vault.create(notePath, table + '\n');
    return;
  }

  if (existing instanceof TFile) {
    const content = await app.vault.read(existing);
    const updated = appendDoseToContent(content, row);
    await app.vault.modify(existing, updated);
  }
}

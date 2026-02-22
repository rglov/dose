import { buildDoseRow, appendDoseToContent } from '../src/daily-note';
import { DoseLog } from '../src/types';

const mockLog: DoseLog = {
  id: '1',
  protocolId: 'test.md',
  compoundName: 'BPC-157',
  dose: '250mcg',
  site: 'Left abdomen',
  timestamp: '2026-02-22T07:30:00.000Z',
  status: 'taken',
};

describe('buildDoseRow', () => {
  test('returns a pipe-delimited markdown table row', () => {
    const row = buildDoseRow(mockLog);
    expect(row.startsWith('|')).toBe(true);
    expect(row.endsWith('|')).toBe(true);
    expect(row).toContain('BPC-157');
    expect(row).toContain('250mcg');
    expect(row).toContain('Left abdomen');
    expect(row).toMatch(/\|\s*\d{2}:\d{2}\s*\|/); // any valid HH:MM time
  });
});

describe('appendDoseToContent', () => {
  test('creates Dose Log section when none exists', () => {
    const content = '# My Day\n\nSome notes.';
    const result = appendDoseToContent(content, '| 07:30 | BPC-157 | 250mcg | Left abdomen |');
    expect(result).toContain('## Dose Log');
    expect(result).toContain('BPC-157');
    expect(result).toContain('| Time | Compound | Dose | Site |');
  });

  test('appends row to existing Dose Log section', () => {
    const content = [
      '# My Day',
      '',
      '## Dose Log',
      '',
      '| Time | Compound | Dose | Site |',
      '|------|----------|------|------|',
      '| 07:30 | BPC-157 | 250mcg | Left abdomen |',
    ].join('\n');

    const result = appendDoseToContent(content, '| 19:45 | BPC-157 | 250mcg | Right abdomen |');
    expect(result).toContain('07:30');
    expect(result).toContain('19:45');
    // Only one Dose Log header
    expect(result.split('## Dose Log').length).toBe(2);
  });

  test('does not duplicate table header when appending', () => {
    const content = [
      '## Dose Log',
      '',
      '| Time | Compound | Dose | Site |',
      '|------|----------|------|------|',
      '| 07:30 | BPC-157 | 250mcg | Left abdomen |',
    ].join('\n');

    const result = appendDoseToContent(content, '| 19:45 | TB-500 | 5mg | Right thigh |');
    expect(result.split('| Time |').length).toBe(2); // only one header row
  });

  test('preserves content after Dose Log section', () => {
    const content = [
      '## Dose Log',
      '',
      '| Time | Compound | Dose | Site |',
      '|------|----------|------|------|',
      '| 07:30 | BPC-157 | 250mcg | Left abdomen |',
      '',
      '## Other Section',
      'Some other content',
    ].join('\n');

    const result = appendDoseToContent(content, '| 19:45 | TB-500 | 5mg | Right thigh |');
    expect(result).toContain('## Other Section');
  });
});

import { Store } from '../src/store';
import { Protocol, DoseLog } from '../src/types';

const mockProtocol: Protocol = {
  id: 'Protocols/test.md',
  name: 'Test Protocol',
  status: 'planned',
  startDate: '2026-02-22',
  durationWeeks: 12,
  compounds: [],
  supplementGroups: [],
  filePath: 'Protocols/test.md',
};

const mockLog: DoseLog = {
  id: 'log-1',
  protocolId: 'Protocols/test.md',
  compoundName: 'BPC-157',
  dose: '250mcg',
  site: 'Left abdomen',
  compoundType: 'injectable',
  timestamp: '2026-02-22T07:30:00.000Z',
  status: 'taken',
};

describe('Store', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store({}, async () => {});
  });

  test('upserts a new protocol', () => {
    store.upsertProtocol(mockProtocol);
    expect(store.getProtocols()).toHaveLength(1);
  });

  test('updates existing protocol without duplicating', () => {
    store.upsertProtocol(mockProtocol);
    store.upsertProtocol({ ...mockProtocol, name: 'Updated' });
    expect(store.getProtocols()).toHaveLength(1);
    expect(store.getProtocols()[0].name).toBe('Updated');
  });

  test('activates a protocol', () => {
    store.upsertProtocol({ ...mockProtocol, id: 'a.md', status: 'planned' });
    store.activateProtocol('a.md');
    expect(store.getProtocols().find(p => p.id === 'a.md')?.status).toBe('active');
  });

  test('pauses previously active protocol when activating another', () => {
    store.upsertProtocol({ ...mockProtocol, id: 'a.md', status: 'active' });
    store.upsertProtocol({ ...mockProtocol, id: 'b.md', status: 'planned' });
    store.activateProtocol('b.md');
    expect(store.getProtocols().find(p => p.id === 'a.md')?.status).toBe('paused');
    expect(store.getProtocols().find(p => p.id === 'b.md')?.status).toBe('active');
  });

  test('returns active protocol', () => {
    store.upsertProtocol({ ...mockProtocol, status: 'active' });
    expect(store.getActiveProtocol()?.id).toBe('Protocols/test.md');
  });

  test('returns undefined when no active protocol', () => {
    store.upsertProtocol(mockProtocol);
    expect(store.getActiveProtocol()).toBeUndefined();
  });

  test('adds and retrieves dose logs by date', () => {
    store.addDoseLog(mockLog);
    expect(store.getDoseLogsForDate('2026-02-22')).toHaveLength(1);
    expect(store.getDoseLogsForDate('2026-02-23')).toHaveLength(0);
  });

  test('retrieves dose logs by protocol', () => {
    store.addDoseLog(mockLog);
    store.addDoseLog({ ...mockLog, id: 'log-2', protocolId: 'other.md' });
    expect(store.getDoseLogsForProtocol('Protocols/test.md')).toHaveLength(1);
  });

  test('calls save callback with current data', async () => {
    let saved: any = null;
    const s = new Store({}, async (data) => { saved = data; });
    s.upsertProtocol(mockProtocol);
    await s.save();
    expect(saved?.protocols).toHaveLength(1);
  });

  test('uses default settings when none provided', () => {
    expect(store.getSettings().protocolsFolder).toBe('Protocols');
    expect(store.getSettings().dailyNotesFolder).toBe('Notes');
    expect(store.getSettings().injectionSites.length).toBeGreaterThan(0);
  });
});

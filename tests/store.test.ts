import { Store } from '../src/store';
import { Protocol, DoseLog } from '../src/types';

const mockProtocol: Protocol = {
  id: 'Protocols/test.md',
  name: 'Test Protocol',
  type: 'injectable',
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

  test('defaults supplementGroups to [] when loading old protocol without it', () => {
    const oldProtocol = {
      id: 'old.md',
      name: 'Old Protocol',
      status: 'active' as const,
      startDate: '2026-01-01',
      durationWeeks: 12,
      compounds: [],
      filePath: 'old.md',
      // intentionally missing supplementGroups
    };
    const s = new Store({ protocols: [oldProtocol as any] }, async () => {});
    expect(s.getProtocols()[0].supplementGroups).toEqual([]);
  });

  test('defaults compoundType to injectable when loading old log without it', () => {
    const oldLog = {
      id: 'old-log',
      protocolId: 'old.md',
      compoundName: 'BPC-157',
      dose: '250mcg',
      site: '',
      timestamp: '2026-01-01T08:00:00Z',
      status: 'taken' as const,
      // intentionally missing compoundType
    };
    const s = new Store({ doseLogs: [oldLog as any] }, async () => {});
    expect(s.getDoseLogsForDate('2026-01-01')[0].compoundType).toBe('injectable');
  });

  // --- Multi-protocol tests ---

  test('getActiveProtocols returns all active protocols', () => {
    store.upsertProtocol({ ...mockProtocol, id: 'a.md', status: 'active', type: 'injectable' });
    store.upsertProtocol({ ...mockProtocol, id: 'b.md', status: 'active', type: 'supplement' });
    store.upsertProtocol({ ...mockProtocol, id: 'c.md', status: 'planned', type: 'supplement' });
    expect(store.getActiveProtocols()).toHaveLength(2);
  });

  test('getActiveProtocol returns only active injectable', () => {
    store.upsertProtocol({ ...mockProtocol, id: 'a.md', status: 'active', type: 'injectable' });
    store.upsertProtocol({ ...mockProtocol, id: 'b.md', status: 'active', type: 'supplement' });
    expect(store.getActiveProtocol()?.id).toBe('a.md');
  });

  test('activating injectable pauses other active injectable but not supplement', () => {
    store.upsertProtocol({ ...mockProtocol, id: 'inj1.md', status: 'active', type: 'injectable' });
    store.upsertProtocol({ ...mockProtocol, id: 'inj2.md', status: 'planned', type: 'injectable' });
    store.upsertProtocol({ ...mockProtocol, id: 'sup.md', status: 'active', type: 'supplement' });
    store.activateProtocol('inj2.md');
    expect(store.getProtocols().find(p => p.id === 'inj1.md')?.status).toBe('paused');
    expect(store.getProtocols().find(p => p.id === 'inj2.md')?.status).toBe('active');
    expect(store.getProtocols().find(p => p.id === 'sup.md')?.status).toBe('active');
  });

  test('activating supplement does not affect other protocols', () => {
    store.upsertProtocol({ ...mockProtocol, id: 'inj.md', status: 'active', type: 'injectable' });
    store.upsertProtocol({ ...mockProtocol, id: 'sup1.md', status: 'active', type: 'supplement' });
    store.upsertProtocol({ ...mockProtocol, id: 'sup2.md', status: 'planned', type: 'supplement' });
    store.activateProtocol('sup2.md');
    expect(store.getProtocols().find(p => p.id === 'inj.md')?.status).toBe('active');
    expect(store.getProtocols().find(p => p.id === 'sup1.md')?.status).toBe('active');
    expect(store.getProtocols().find(p => p.id === 'sup2.md')?.status).toBe('active');
  });

  test('deactivateProtocol sets status to paused', () => {
    store.upsertProtocol({ ...mockProtocol, id: 'sup.md', status: 'active', type: 'supplement' });
    store.deactivateProtocol('sup.md');
    expect(store.getProtocols().find(p => p.id === 'sup.md')?.status).toBe('paused');
  });
});

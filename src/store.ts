import { DoseStore, Protocol, DoseLog, DoseSettings, SupplementGroup, ProtocolType } from './types';

const DEFAULT_SETTINGS: DoseSettings = {
  protocolsFolder: 'Protocols',
  dailyNotesFolder: 'Notes',
  injectionSites: [
    'Left abdomen', 'Right abdomen',
    'Left thigh', 'Right thigh',
    'Left delt', 'Right delt',
  ],
};

const DEFAULT_STORE: DoseStore = {
  version: 1,
  protocols: [],
  doseLogs: [],
  settings: DEFAULT_SETTINGS,
};

export class Store {
  private data: DoseStore;
  private saveCallback: (data: DoseStore) => Promise<void>;

  constructor(saved: Partial<DoseStore>, saveCallback: (data: DoseStore) => Promise<void>) {
    this.data = {
      version: saved.version ?? DEFAULT_STORE.version,
      protocols: saved.protocols
        ? saved.protocols.map(p => ({
            ...p,
            type: p.type ?? 'injectable',
            supplementGroups: p.supplementGroups ?? [],
          }))
        : [],
      doseLogs: saved.doseLogs
        ? saved.doseLogs.map(l => ({ ...l, compoundType: l.compoundType ?? 'injectable' }))
        : [],
      settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
    };
    this.saveCallback = saveCallback;
  }

  getProtocols(): Protocol[] { return this.data.protocols; }

  /** @deprecated Use getActiveProtocols() for multi-protocol support. Kept for backward compatibility. */
  getActiveProtocol(): Protocol | undefined {
    return this.data.protocols.find(p => p.status === 'active' && p.type === 'injectable');
  }

  getActiveProtocols(): Protocol[] {
    return this.data.protocols.filter(p => p.status === 'active');
  }

  upsertProtocol(protocol: Protocol): void {
    const idx = this.data.protocols.findIndex(p => p.id === protocol.id);
    if (idx >= 0) {
      this.data.protocols[idx] = protocol;
    } else {
      this.data.protocols.push(protocol);
    }
  }

  activateProtocol(id: string): void {
    const target = this.data.protocols.find(p => p.id === id);
    if (!target) return;
    this.data.protocols = this.data.protocols.map(p => ({
      ...p,
      status: p.id === id
        ? 'active'
        : (target.type === 'injectable' && p.type === 'injectable' && p.status === 'active')
          ? 'paused'
          : p.status,
    }));
  }

  deactivateProtocol(id: string): void {
    const idx = this.data.protocols.findIndex(p => p.id === id);
    if (idx >= 0 && this.data.protocols[idx].status === 'active') {
      this.data.protocols[idx] = { ...this.data.protocols[idx], status: 'paused' };
    }
  }

  addDoseLog(log: DoseLog): void {
    this.data.doseLogs.push(log);
  }

  getDoseLogsForDate(date: string): DoseLog[] {
    return this.data.doseLogs.filter(l => l.timestamp.startsWith(date));
  }

  getDoseLogsForProtocol(protocolId: string): DoseLog[] {
    return this.data.doseLogs.filter(l => l.protocolId === protocolId);
  }

  getSettings(): DoseSettings {
    return { ...this.data.settings, injectionSites: [...this.data.settings.injectionSites] };
  }

  updateSettings(settings: Partial<DoseSettings>): void {
    this.data.settings = { ...this.data.settings, ...settings };
  }

  async save(): Promise<void> {
    await this.saveCallback(this.data);
  }

  /** Returns the store data for serialization. Do not mutate the returned object. */
  getData(): DoseStore { return this.data; }
}

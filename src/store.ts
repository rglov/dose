import { DoseStore, Protocol, DoseLog, DoseSettings } from './types';

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
      protocols: saved.protocols ? [...saved.protocols] : [],
      doseLogs: saved.doseLogs ? [...saved.doseLogs] : [],
      settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
    };
    this.saveCallback = saveCallback;
  }

  getProtocols(): Protocol[] { return this.data.protocols; }

  getActiveProtocol(): Protocol | undefined {
    return this.data.protocols.find(p => p.status === 'active');
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
    this.data.protocols = this.data.protocols.map(p => ({
      ...p,
      status: p.id === id
        ? 'active'
        : p.status === 'active' ? 'paused' : p.status,
    }));
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

  getSettings(): DoseSettings { return this.data.settings; }

  updateSettings(settings: Partial<DoseSettings>): void {
    this.data.settings = { ...this.data.settings, ...settings };
  }

  async save(): Promise<void> {
    await this.saveCallback(this.data);
  }

  getData(): DoseStore { return this.data; }
}

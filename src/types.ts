export type ProtocolStatus = 'active' | 'planned' | 'paused' | 'completed';
export type ProtocolType = 'injectable' | 'supplement';
export type DoseStatus = 'taken' | 'skipped' | 'extra';
export type FrequencyType = 'daily' | 'twice_daily' | 'weekly';

export interface CompoundFrequency {
  type: FrequencyType;
  days?: number[]; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
}

export interface Compound {
  name: string;
  dose: string;
  route: string;
  frequency: CompoundFrequency;
}

export interface SupplementItem {
  name: string;
  dose: string; // e.g. "3x", "5mg", "" if not specified
}

export interface SupplementGroup {
  timeLabel: string; // e.g. "Morning (fasted)", "Breakfast 8AM"
  items: SupplementItem[];
}

export interface Protocol {
  id: string;          // vault file path, used as unique key
  name: string;
  type: ProtocolType;  // 'injectable' | 'supplement'
  status: ProtocolStatus;
  startDate: string;   // YYYY-MM-DD
  durationWeeks: number;
  compounds: Compound[];
  supplementGroups: SupplementGroup[];
  filePath: string;
}

export interface DoseLog {
  id: string;
  protocolId: string;
  compoundName: string;
  dose: string;
  site: string;
  compoundType: 'injectable' | 'supplement';
  timestamp: string;   // ISO 8601
  status: DoseStatus;
}

export interface DoseSettings {
  protocolsFolder: string;
  dailyNotesFolder: string;
  injectionSites: string[];
}

export interface DoseStore {
  version: number;
  protocols: Protocol[];
  doseLogs: DoseLog[];
  settings: DoseSettings;
}

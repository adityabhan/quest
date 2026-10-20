export type Step = 'bedroom' | 'bag-picked' | 'cab-booked' | 'restaurant' | 'menu-opened' | 'soup-ordered' | 'soup-finished' | 'spark-collected' | 'memory-complete' | 'sanctuary' | 'followed-birds' | 'feather-collected' | 'sanctuary-memory' | 'mission-2-complete' | 'pind-arrival' | 'pind-table' | 'chaas-finished' | 'photo-collected' | 'pind-memory' | 'mission-3-complete' | 'bowling-arrival' | 'bowling-roll-1' | 'bowling-roll-2' | 'pin-collected' | 'bowling-memory' | 'mission-4-complete' | 'park-arrival' | 'mosquitoes-cleared' | 'moon-found' | 'final-memory' | 'castle-garden' | 'adventure-complete';

export interface JournalEntry { title: string; body: string; }
export interface MissionState {
  version: 1;
  missionId: 'mission-1' | 'mission-2' | 'mission-3' | 'mission-4' | 'mission-5';
  step: Step;
  hasHandbag: boolean;
  soupStatus: 'not-ordered' | 'ordered' | 'finished';
  bowlingPins: number;
  artifacts: string[];
  journalEntries: JournalEntry[];
  updatedAt: number;
}

const key = 'sammy-adventurer-poc-v1';
export const freshProgress = (): MissionState => ({ version: 1, missionId: 'mission-1', step: 'bedroom', hasHandbag: false, soupStatus: 'not-ordered', bowlingPins: 0, artifacts: [], journalEntries: [], updatedAt: Date.now() });
export function loadProgress(): MissionState | null {
  try { const raw = localStorage.getItem(key); const value = raw ? JSON.parse(raw) : null; return value?.version === 1 && ['mission-1', 'mission-2', 'mission-3', 'mission-4', 'mission-5'].includes(value?.missionId) ? { ...value, bowlingPins: value.bowlingPins ?? 0 } : null; } catch { return null; }
}
export function saveProgress(state: MissionState) { state.updatedAt = Date.now(); localStorage.setItem(key, JSON.stringify(state)); }
export function resetProgress() { localStorage.removeItem(key); }

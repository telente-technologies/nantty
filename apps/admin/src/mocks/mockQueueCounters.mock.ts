export interface MockQueueCounter {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly readCount: () => { count: number; oldestAt: string | null; breachingSla?: number };
}

const queueCountersKey = Symbol.for("nantty.admin.mockQueueCounters");

function readCounterList(): MockQueueCounter[] {
  const globalScope = globalThis as unknown as Record<symbol, MockQueueCounter[] | undefined>;
  globalScope[queueCountersKey] ??= [];
  return globalScope[queueCountersKey];
}

export function registerMockQueueCounter(counter: MockQueueCounter): void {
  const counters = readCounterList();
  const existingIndex = counters.findIndex((candidate) => candidate.key === counter.key);
  if (existingIndex >= 0) counters.splice(existingIndex, 1, counter);
  else counters.push(counter);
}

export function readEveryMockQueueCounter(): readonly MockQueueCounter[] {
  return readCounterList();
}

export function createSeededRandomNumberGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function pickRandomItem<Item>(items: readonly Item[], random: () => number): Item {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error("Cannot pick from an empty list.");
  return item;
}

export function pickRandomIntegerInclusive(minimum: number, maximum: number, random: () => number): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

export function buildIsoDateDaysAgo(daysAgo: number, hourOfDay = 12, minute = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(hourOfDay, minute, 0, 0);
  return date.toISOString();
}

export function createSeededRandomNumberGenerator(seedText: string): () => number {
  let seed = 0;
  for (const character of seedText) seed = (Math.imul(seed ^ character.charCodeAt(0), 2654435761) + 1) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickBetween(random: () => number, minimum: number, maximum: number): number {
  return minimum + (maximum - minimum) * random();
}

export function buildUnsplashImageUrl(photoId: string, width = 800): string {
  return `https://images.unsplash.com/photo-${photoId}?w=${width}&q=80&fm=webp`;
}

export function shiftIsoDateByDays(days: number, from = new Date()): string {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + days)).toISOString().slice(0, 10);
}

export function shiftTimestampByDays(days: number, hour = 9): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days, hour)).toISOString();
}

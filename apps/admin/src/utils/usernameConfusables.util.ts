const homoglyphReplacements: readonly [string, string][] = [
  ["а", "a"], ["е", "e"], ["о", "o"], ["р", "p"], ["с", "c"], ["у", "y"], ["х", "x"], ["і", "i"], ["ј", "j"], ["ѕ", "s"], ["ԁ", "d"], ["ɡ", "g"], ["ο", "o"], ["α", "a"], ["ν", "v"], ["τ", "t"], ["κ", "k"],
  ["0", "o"], ["1", "l"], ["!", "l"], ["|", "l"], ["i", "l"], ["3", "e"], ["4", "a"], ["5", "s"], ["$", "s"], ["7", "t"], ["8", "b"], ["@", "a"],
  ["vv", "w"], ["rn", "m"], ["cl", "d"],
];

export function normalizeUsernameForComparison(candidate: string): string {
  return candidate.normalize("NFKC").toLowerCase().trim().replace(/^@+/, "");
}

export function computeConfusableSkeletonForUsername(candidate: string): string {
  let skeleton = normalizeUsernameForComparison(candidate).normalize("NFKD").replace(/[̀-ͯ]/g, "");
  for (const [lookalike, canonical] of homoglyphReplacements) skeleton = skeleton.split(lookalike).join(canonical);
  return skeleton.replace(/[._\-\s]/g, "");
}

export function convertGlobPatternToSafeRegularExpression(globPattern: string): RegExp {
  const escaped = normalizeUsernameForComparison(globPattern)
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`);
}

export function isValidUsernameShape(candidate: string): boolean {
  return /^[a-z0-9._]{3,30}$/.test(candidate);
}

function readUnbiasedRandomIndex(maxExclusive: number): number {
  const randomBuffer = new Uint32Array(1);
  const unbiasedLimit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  do {
    globalThis.crypto.getRandomValues(randomBuffer);
  } while (randomBuffer[0]! >= unbiasedLimit);
  return randomBuffer[0]! % maxExclusive;
}

export function generateReplacementUsername(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let suffix = "";
  for (let index = 0; index < 6; index += 1) suffix += alphabet[readUnbiasedRandomIndex(alphabet.length)];
  return `user_${suffix}`;
}

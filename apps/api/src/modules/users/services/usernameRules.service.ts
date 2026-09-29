import { BRAND_IMPERSONATION_AFFIXES, type ReservedUsernameRule } from "../../../constants/reservedUsernames.constant.js";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

const LOOKALIKE_CHARACTERS: Readonly<Record<string, string>> = {
  "0": "o", "1": "l", "!": "l", "|": "l", i: "l", "3": "e", "4": "a", "@": "a", "5": "s", $: "s", "7": "t", "8": "b", "9": "g", "6": "g", "2": "z",
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "l", "ј": "j", "ѕ": "s", "ԁ": "d", "ɡ": "g", "к": "k", "м": "m",
  "т": "t", "в": "b", "н": "h", "ո": "n", "ս": "u", "α": "a", "β": "b", "ε": "e", "ι": "l", "κ": "k", "ν": "v", "ο": "o", "ρ": "p", "τ": "t",
  "υ": "u", "χ": "x", "ω": "w", "ı": "l", "ł": "l", "ø": "o", "đ": "d", "ß": "ss",
};

export function normalizeRequestedUsername(username: string): string {
  return username.normalize("NFKC").trim().replace(/^@/, "").toLowerCase();
}

export function usernameHasValidFormat(username: string): boolean {
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) return false;
  if (!/^[a-z0-9._]+$/.test(username) || !/[a-z]/.test(username)) return false;
  return !username.startsWith(".") && !username.endsWith(".") && !username.includes("..");
}

export function buildConfusableSkeleton(value: string): string {
  const withoutAccents = value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  const mapped = [...withoutAccents].map((character) => LOOKALIKE_CHARACTERS[character] ?? character).join("");
  return mapped
    .replace(/[^a-z]/g, "")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .replace(/(.)\1+/g, "$1");
}

function skeletonMatchesBrand(skeleton: string, brandSkeleton: string): boolean {
  if (skeleton === brandSkeleton) return true;
  return BRAND_IMPERSONATION_AFFIXES.some((affix) => {
    const affixSkeleton = buildConfusableSkeleton(affix);
    return skeleton === `${brandSkeleton}${affixSkeleton}` || skeleton === `${affixSkeleton}${brandSkeleton}`;
  });
}

export function findMatchingReservedRule(username: string, rules: readonly ReservedUsernameRule[]): ReservedUsernameRule | undefined {
  const skeleton = buildConfusableSkeleton(username);
  if (skeleton === "") return undefined;
  return rules.find((rule) => {
    const term = buildConfusableSkeleton(rule.term);
    if (term === "") return false;
    if (rule.matchKind === "exact") return skeleton === term;
    if (rule.matchKind === "prefix") return skeleton.startsWith(term);
    if (rule.matchKind === "contains") return skeleton.includes(term);
    return skeletonMatchesBrand(skeleton, term);
  });
}

export function buildUsernameBaseFromSeed(seed: string): string {
  const letters = seed.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().split("@")[0] ?? "";
  return letters.replace(/[^a-z0-9]/g, "").slice(0, 20);
}

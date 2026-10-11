export const MAX_BLOCKED_WORDS = 100;
export const MIN_BLOCKED_WORD_LENGTH = 2;
export const MAX_BLOCKED_WORD_LENGTH = 30;

export const normaliseBlockedWord = (raw: string) => raw.normalize("NFKC").trim().toLowerCase();

export function addBlockedWords(current: readonly string[], input: string): { readonly words: readonly string[]; readonly error: string | null } {
  const candidates = input.split(",").map(normaliseBlockedWord).filter(Boolean);
  if (candidates.length === 0) return { words: current, error: "Type a word or phrase to block." };
  const invalid = candidates.find((word) => [...word].length < MIN_BLOCKED_WORD_LENGTH || [...word].length > MAX_BLOCKED_WORD_LENGTH);
  if (invalid) return { words: current, error: `Blocked words must be ${MIN_BLOCKED_WORD_LENGTH}-${MAX_BLOCKED_WORD_LENGTH} characters ("${invalid}" isn't).` };
  const words = [...new Set([...current, ...candidates])];
  if (words.length > MAX_BLOCKED_WORDS) return { words: current, error: `You can block up to ${MAX_BLOCKED_WORDS} words.` };
  return { words, error: null };
}

const stopWords = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "so", "to", "of", "in", "on", "at", "by", "for", "with", "from", "into", "about", "as", "is", "are",
  "was", "were", "be", "been", "being", "am", "do", "does", "did", "doing", "have", "has", "had", "i", "me", "my", "mine", "we", "our", "you", "your",
  "it", "its", "this", "that", "these", "those", "there", "here", "what", "which", "who", "whom", "how", "why", "when", "where", "can", "could", "will",
  "would", "should", "shall", "may", "might", "must", "not", "no", "yes", "please", "help", "hi", "hello", "thanks", "thank", "just", "still", "also",
  "get", "got", "any", "all", "some", "very", "too", "up", "out", "now", "again", "already", "want", "need", "know", "tell", "let", "one", "after", "before",
]);

export function stemWord(word: string): string {
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ied")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function normalizeForSearch(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\[[a-z ]+\]/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function extractKeywords(text: string): string[] {
  return normalizeForSearch(text).split(" ").filter((word) => word.length > 1 && !stopWords.has(word)).map(stemWord);
}

export function jaccardSimilarity(first: readonly string[], second: readonly string[]): number {
  const left = new Set(first);
  const right = new Set(second);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function characterTrigrams(text: string): Set<string> {
  const padded = `  ${normalizeForSearch(text)} `;
  const grams = new Set<string>();
  for (let index = 0; index < padded.length - 2; index += 1) grams.add(padded.slice(index, index + 3));
  return grams;
}

export function trigramSimilarity(first: string, second: string): number {
  const left = characterTrigrams(first);
  const right = characterTrigrams(second);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}

export function rankKeywordsByFrequency(text: string, limit: number): string[] {
  const counts = new Map<string, number>();
  for (const word of extractKeywords(text)) if (word.length > 2 && !/^\d+$/.test(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts.entries()].sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0])).slice(0, limit).map(([word]) => word);
}

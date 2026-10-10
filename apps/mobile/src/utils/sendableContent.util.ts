const INVISIBLE_CODE_POINT_RANGES: readonly (readonly [number, number])[] = [
  [0x00ad, 0x00ad],
  [0x180e, 0x180e],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2064],
  [0xfe00, 0xfe0f],
  [0xfeff, 0xfeff],
];

function isBlankCodePoint(char: string): boolean {
  if (char.trim() === "") return true;
  const codePoint = char.codePointAt(0) ?? 0;
  return INVISIBLE_CODE_POINT_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);
}

export function hasSendableContent(text: string | null | undefined): boolean {
  if (!text) return false;
  for (const char of text) {
    if (!isBlankCodePoint(char)) return true;
  }
  return false;
}

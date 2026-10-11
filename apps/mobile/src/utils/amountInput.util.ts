const majorAmountPattern = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

export function parseMajorAmountToMinorUnits(text: string): number | null {
  const match = majorAmountPattern.exec(text.trim());
  if (!match) return null;
  const minor = Number((match[1] ?? "").replace(/,/g, "") + (match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

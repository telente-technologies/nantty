export function calculateEan13CheckDigit(firstTwelveDigits: string): number {
  const weightedSum = firstTwelveDigits
    .split("")
    .reduce((sum, digitText, index) => sum + Number(digitText) * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (weightedSum % 10)) % 10;
}

export function buildEan13FromTwelveDigits(firstTwelveDigits: string): string {
  if (!/^\d{12}$/.test(firstTwelveDigits)) throw new Error("EAN-13 needs exactly 12 leading digits.");
  return `${firstTwelveDigits}${calculateEan13CheckDigit(firstTwelveDigits)}`;
}

export function isValidEan13(candidate: string): boolean {
  return /^\d{13}$/.test(candidate) && calculateEan13CheckDigit(candidate.slice(0, 12)) === Number(candidate[12]);
}

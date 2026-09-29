export function convertPercentTextToBasisPoints(percentText: string): number | null {
  const normalisedText = percentText.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalisedText)) return null;
  const basisPoints = Math.round(Number(normalisedText) * 100);
  return basisPoints >= 0 && basisPoints <= 10_000 ? basisPoints : null;
}

export function convertBasisPointsToPercentText(basisPoints: number): string {
  const percent = basisPoints / 100;
  return Number.isInteger(percent) ? String(percent) : String(Number(percent.toFixed(2)));
}

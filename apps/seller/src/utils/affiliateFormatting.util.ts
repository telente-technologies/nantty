export const maximumAffiliateCommissionPercent = 50;

export function convertPercentTextToBasisPoints(percentText: string): number | null {
  const normalisedText = percentText.trim();
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(normalisedText)) return null;
  const basisPoints = Math.round(Number(normalisedText) * 100);
  return basisPoints <= maximumAffiliateCommissionPercent * 100 ? basisPoints : null;
}

export function convertBasisPointsToPercentText(basisPoints: number | null): string {
  if (basisPoints === null) return "";
  const percent = basisPoints / 100;
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(2).replace(/0$/, "");
}

export function formatFollowerCountCompact(followers: number, locale = "en-NG"): string {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(followers);
}

export function convertLocalDateTimeInputToIso(localDateTimeText: string): string | null {
  if (!localDateTimeText) return null;
  const date = new Date(localDateTimeText);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

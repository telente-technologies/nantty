export function normalizeSellerCountryCode(countryCode: string | null | undefined): string | null {
  const normalized = countryCode?.trim().toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

export function isSellerApplicationCountryEligible(countryCode: string | null | undefined): boolean {
  return normalizeSellerCountryCode(countryCode) === "NG";
}

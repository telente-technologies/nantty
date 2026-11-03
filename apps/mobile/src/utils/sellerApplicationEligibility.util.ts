export type SellerApplicationCountryState = "eligible" | "country_required" | "unsupported_country";

export function getSellerApplicationCountryState(countryCode: string | null | undefined): SellerApplicationCountryState {
  const normalizedCountryCode = countryCode?.trim().toUpperCase();
  if (!normalizedCountryCode) return "country_required";
  return normalizedCountryCode === "NG" ? "eligible" : "unsupported_country";
}

export function isSellerApplicationContactComplete(contact: {
  readonly phone: string;
  readonly addressLine: string;
  readonly city: string;
  readonly state: string;
}): boolean {
  return contact.phone.replace(/\D/g, "").length >= 10
    && Boolean(contact.addressLine.trim())
    && Boolean(contact.city.trim())
    && Boolean(contact.state.trim());
}

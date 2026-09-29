export const defaultDisplayLocale = "en-NG";

export const supportedAccountCountries: readonly { readonly code: string; readonly name: string; readonly timezone: string; readonly currency: string }[] = [
  { code: "NG", name: "Nigeria", timezone: "Africa/Lagos", currency: "NGN" },
  { code: "GH", name: "Ghana", timezone: "Africa/Accra", currency: "GHS" },
  { code: "KE", name: "Kenya", timezone: "Africa/Nairobi", currency: "KES" },
  { code: "ZA", name: "South Africa", timezone: "Africa/Johannesburg", currency: "ZAR" },
  { code: "GB", name: "United Kingdom", timezone: "Europe/London", currency: "GBP" },
  { code: "US", name: "United States", timezone: "America/New_York", currency: "USD" },
];

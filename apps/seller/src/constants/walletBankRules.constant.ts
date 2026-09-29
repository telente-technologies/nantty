export interface PayoutAccountNumberRule {
  readonly label: string;
  readonly pattern: RegExp;
  readonly hint: string;
}

const payoutAccountNumberRulesByCountry: Record<string, PayoutAccountNumberRule> = {
  NG: { label: "Account number (NUBAN)", pattern: /^\d{10}$/, hint: "10 digits" },
  GH: { label: "Account number", pattern: /^\d{10,16}$/, hint: "10 to 16 digits" },
  KE: { label: "Account number", pattern: /^\d{8,16}$/, hint: "8 to 16 digits" },
  ZA: { label: "Account number", pattern: /^\d{9,12}$/, hint: "9 to 12 digits" },
};

const fallbackPayoutAccountNumberRule: PayoutAccountNumberRule = { label: "Account number or IBAN", pattern: /^[A-Za-z0-9]{6,34}$/, hint: "6 to 34 letters or digits" };

export function readPayoutAccountNumberRuleForCountry(countryCode: string | null | undefined): PayoutAccountNumberRule {
  return (countryCode && payoutAccountNumberRulesByCountry[countryCode]) || fallbackPayoutAccountNumberRule;
}

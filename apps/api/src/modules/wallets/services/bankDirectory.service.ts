import { normalizeCountryCode } from "../../../configs/currency.config.js";

export interface BankOption {
  readonly code: string;
  readonly name: string;
}

export interface BankDirectory {
  listBanksForCountry(countryCode: string): Promise<readonly BankOption[]>;
}

export const NIGERIAN_BANKS_FALLBACK: readonly BankOption[] = [
  { code: "044", name: "Access Bank" },
  { code: "023", name: "Citibank Nigeria" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "070", name: "Fidelity Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank" },
  { code: "058", name: "Guaranty Trust Bank" },
  { code: "030", name: "Heritage Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "50211", name: "Kuda Bank" },
  { code: "50515", name: "Moniepoint MFB" },
  { code: "999992", name: "OPay" },
  { code: "999991", name: "PalmPay" },
  { code: "076", name: "Polaris Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "033", name: "United Bank For Africa" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" },
];

const PAYSTACK_COUNTRY_NAMES: Readonly<Record<string, string>> = { NG: "nigeria", GH: "ghana", KE: "kenya", ZA: "south africa" };
const CACHE_LIFETIME_MILLISECONDS = 12 * 60 * 60 * 1000;

export class StaticBankDirectory implements BankDirectory {
  public async listBanksForCountry(countryCode: string): Promise<readonly BankOption[]> {
    return normalizeCountryCode(countryCode) === "NG" ? NIGERIAN_BANKS_FALLBACK : [];
  }
}

export class PaystackBankDirectory implements BankDirectory {
  private readonly cache = new Map<string, { readonly banks: readonly BankOption[]; readonly fetchedAt: number }>();
  private readonly fallback = new StaticBankDirectory();

  public constructor(private readonly secretKey: string) {}

  public async listBanksForCountry(countryCode: string): Promise<readonly BankOption[]> {
    const normalized = normalizeCountryCode(countryCode);
    const paystackCountry = normalized === null ? undefined : PAYSTACK_COUNTRY_NAMES[normalized];
    if (normalized === null || paystackCountry === undefined) return [];
    const cached = this.cache.get(normalized);
    if (cached !== undefined && Date.now() - cached.fetchedAt < CACHE_LIFETIME_MILLISECONDS) return cached.banks;
    try {
      const banks = await this.downloadBanksFromPaystack(paystackCountry);
      this.cache.set(normalized, { banks, fetchedAt: Date.now() });
      return banks;
    } catch {
      return this.fallback.listBanksForCountry(normalized);
    }
  }

  private async downloadBanksFromPaystack(paystackCountry: string): Promise<readonly BankOption[]> {
    if (this.secretKey === "") throw new Error("Paystack is not configured.");
    const url = new URL("https://api.paystack.co/bank");
    url.searchParams.set("country", paystackCountry);
    url.searchParams.set("perPage", "200");
    const response = await fetch(url, { headers: { authorization: `Bearer ${this.secretKey}` }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Paystack answered ${response.status}.`);
    const body = (await response.json()) as { data?: { code?: unknown; name?: unknown; active?: unknown }[] };
    return (body.data ?? [])
      .filter((bank) => typeof bank.code === "string" && typeof bank.name === "string" && bank.active !== false)
      .map((bank) => ({ code: String(bank.code), name: String(bank.name) }));
  }
}

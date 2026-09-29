export type ReservedUsernameMatchKind = "exact" | "prefix" | "contains" | "brand";

export interface ReservedUsernameRule {
  readonly term: string;
  readonly matchKind: ReservedUsernameMatchKind;
}

const EXACT_TERMS = [
  "root", "help", "payments", "payment", "wallet", "escrow", "billing", "staff", "mod", "mods", "team", "api", "www", "mail", "email",
  "ads", "dashboard", "system", "null", "undefined", "anonymous", "me", "settings", "login", "signup", "account", "accounts", "about",
  "terms", "privacy", "legal", "careers", "jobs", "press", "news", "status", "blog", "shop", "store", "market", "mart", "seller",
  "sellers", "buyer", "notifications", "messages", "explore", "search", "home", "contact", "info", "abuse", "postmaster", "hostmaster",
  "webmaster", "noreply", "owner", "founder", "ceo",
] as const;

const PREFIX_TERMS = [
  "admin", "superadmin", "verify", "verified", "official", "support", "security", "moderator", "customercare", "helpdesk",
  "government", "govt", "ministry", "federal", "presidency", "president", "governor", "senate", "senator", "police", "army", "navy",
  "airforce", "customs", "immigration", "efcc", "inec", "nnpc", "nafdac", "statehouse", "centralbank",
] as const;

const CONTAINS_TERMS = ["zudomart", "zudopay"] as const;

export const WELL_KNOWN_BRANDS = [
  "google", "apple", "facebook", "instagram", "meta", "whatsapp", "tiktok", "twitter", "youtube", "snapchat", "linkedin", "telegram",
  "amazon", "microsoft", "netflix", "spotify", "paypal", "visa", "mastercard", "samsung", "jumia", "konga", "paystack", "flutterwave",
  "opay", "palmpay", "moniepoint", "kuda", "mtn", "airtel", "glo", "dangote", "access", "gtbank", "zenithbank", "firstbank", "uba",
  "stanbic", "nike", "adidas", "cocacola", "pepsi", "shoprite", "bolt", "uber", "chowdeck", "glovo",
] as const;

export const BRAND_IMPERSONATION_AFFIXES = [
  "official", "ng", "nigeria", "africa", "hq", "support", "help", "care", "team", "app", "global", "real", "the", "verified", "inc", "ltd", "store", "shop",
] as const;

export const SYSTEM_RESERVED_USERNAME_RULES: readonly ReservedUsernameRule[] = [
  ...EXACT_TERMS.map((term) => ({ term, matchKind: "exact" as const })),
  ...PREFIX_TERMS.map((term) => ({ term, matchKind: "prefix" as const })),
  ...CONTAINS_TERMS.map((term) => ({ term, matchKind: "contains" as const })),
  ...WELL_KNOWN_BRANDS.map((term) => ({ term, matchKind: "brand" as const })),
];

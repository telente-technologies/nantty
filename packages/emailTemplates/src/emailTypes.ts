export interface Money {
  readonly amountMinor: number;
  readonly currency: string;
}

export type EmailKind = "transactional" | "security" | "legal" | "marketing";
export type EmailTheme = "auto" | "light" | "dark";
export type Tone = "brand" | "success" | "warn" | "danger" | "neutral";

export type EmailCategory =
  | "auth"
  | "orders"
  | "escrow"
  | "seller"
  | "payments"
  | "creator"
  | "checkmarks"
  | "social"
  | "trust"
  | "privacy"
  | "support"
  | "marketing";

export type RichPart = string | { readonly strong: string } | { readonly link: string; readonly href: string };
export type Rich = string | readonly RichPart[];

export interface EmailLink {
  readonly label: string;
  readonly href: string;
}

export interface DetailRow {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
  readonly strong?: boolean;
}

export interface OrderLineItem {
  readonly name: string;
  readonly variant?: string;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly imageUrl: string;
}

export interface SellerItemGroup {
  readonly sellerName: string;
  readonly sellerVerified?: boolean;
  readonly items: readonly OrderLineItem[];
  readonly shipping: Money;
  readonly shippingMethod?: string;
  readonly status?: string;
}

export interface ProductCard {
  readonly name: string;
  readonly imageUrl: string;
  readonly price: Money;
  readonly compareAtPrice?: Money;
  readonly sellerName: string;
  readonly href: string;
  readonly badge?: string;
}

export interface PersonCard {
  readonly name: string;
  readonly handle: string;
  readonly note?: string;
}

export type StepState = "done" | "current" | "todo";

export type EmailBlock =
  | { readonly type: "hero"; readonly eyebrow: string; readonly title: string; readonly tone?: Tone }
  | { readonly type: "paragraph"; readonly text: Rich; readonly muted?: boolean }
  | { readonly type: "button"; readonly label: string; readonly href: string; readonly tone?: "brand" | "danger" }
  | { readonly type: "links"; readonly items: readonly EmailLink[] }
  | { readonly type: "callout"; readonly tone: Tone; readonly title?: string; readonly text: Rich }
  | { readonly type: "details"; readonly title?: string; readonly rows: readonly DetailRow[] }
  | { readonly type: "code"; readonly code: string; readonly caption: string }
  | { readonly type: "orderGroups"; readonly groups: readonly SellerItemGroup[] }
  | { readonly type: "totals"; readonly rows: readonly { readonly label: string; readonly amount: Money; readonly credit?: boolean }[]; readonly total: { readonly label: string; readonly amount: Money } }
  | { readonly type: "track"; readonly steps: readonly string[]; readonly current: number; readonly tone?: Tone; readonly caption?: string }
  | { readonly type: "steps"; readonly items: readonly { readonly title: string; readonly text: string; readonly state: StepState }[] }
  | { readonly type: "progress"; readonly items: readonly { readonly label: string; readonly value: number; readonly target: number; readonly display?: string }[] }
  | { readonly type: "products"; readonly title?: string; readonly items: readonly ProductCard[] }
  | { readonly type: "list"; readonly title?: string; readonly items: readonly Rich[] }
  | { readonly type: "quote"; readonly author: string; readonly text: string; readonly meta?: string }
  | { readonly type: "people"; readonly items: readonly PersonCard[]; readonly more?: string }
  | { readonly type: "rating"; readonly question: string; readonly options: readonly EmailLink[] }
  | { readonly type: "divider" };

export interface EmailBrandConfig {
  readonly productName: string;
  readonly companyLegalName: string;
  readonly companyAddress: string;
  readonly webBaseUrl: string;
  readonly helpCenterUrl: string;
  readonly sellerDashboardUrl: string;
  readonly studioUrl: string;
  readonly supportEmails: readonly string[];
  readonly logoUrl: string | null;
  readonly logoWidth: number;
  readonly appStoreUrl: string;
  readonly playStoreUrl: string;
  readonly appStoreBadgeUrl: string | null;
  readonly playStoreBadgeUrl: string | null;
}

export interface EmailLinks {
  readonly unsubscribeUrl: string;
  readonly preferencesUrl: string;
  readonly manageNotificationsUrl: string;
}

export interface EmailContext {
  readonly locale: string;
  readonly theme: EmailTheme;
  readonly brand: EmailBrandConfig;
  readonly links: EmailLinks;
  readonly money: (amount: Money) => string;
  readonly date: (iso: string) => string;
  readonly dateTime: (iso: string) => string;
  readonly url: (path: string) => string;
}

export interface RecipientProps {
  readonly firstName: string;
}

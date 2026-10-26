import type { Money } from "../emailTypes";
import { ngn } from "../samples/sampleData";
import { consentRules, defineEmailTemplate } from "./defineTemplate";

interface StoreCreditProps {
  readonly firstName: string;
  readonly storeName: string;
  readonly storeUrl: string;
  readonly balance: Money;
  readonly expiresAt: string;
  readonly minimumOrder?: Money;
}

const base = { category: "orders", kind: "transactional", audience: "Buyer", consent: consentRules.transactionalOptOut } as const;
const rules = (p: StoreCreditProps, money: (amount: Money) => string) =>
  `Store credit is a discount at ${p.storeName} only. It isn't cash and can't be withdrawn${p.minimumOrder ? `; use it on orders over ${money(p.minimumOrder)}` : ""}. If the order that earned it is refunded, the credit is removed.`;

export const storeCreditEarned = defineEmailTemplate<StoreCreditProps & { readonly earned: Money; readonly orderNumber: string }>({
  ...base, key: "storeCreditEarned", name: "Store credit earned", trigger: "rewards.store_credit.earned (on order completion)",
  subject: (p, c) => `You earned ${c.money(p.earned)} to spend at ${p.storeName}`,
  preheader: (p, c) => `Use it before ${c.date(p.expiresAt)}.`,
  reference: (p) => `ORDER ${p.orderNumber}`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Store rewards", title: `${c.money(p.earned)} store credit at ${p.storeName}`, tone: "success" },
    { type: "paragraph", text: `Hi ${p.firstName}, ${p.storeName} rewards repeat customers. Your completed order ${p.orderNumber} earned you credit for next time.` },
    { type: "details", rows: [{ label: "Earned", value: c.money(p.earned) }, { label: `Balance at ${p.storeName}`, value: c.money(p.balance), strong: true }, { label: "Expires", value: c.date(p.expiresAt) }] },
    { type: "button", label: `Shop ${p.storeName}`, href: p.storeUrl },
    { type: "paragraph", muted: true, text: rules(p, c.money) },
  ],
  sample: { firstName: "Amaka", storeName: "Adire Lagos Studio", storeUrl: "https://nantty.com/@adirelagos", earned: ngn(3300), balance: ngn(4800), expiresAt: "2027-01-06T23:59:00.000Z", orderNumber: "ZM-48213", minimumOrder: ngn(10000) },
});

export const storeCreditExpiring = defineEmailTemplate<StoreCreditProps>({
  ...base, key: "storeCreditExpiring", name: "Store credit expiring", trigger: "rewards.store_credit.expiring (7 days before)",
  subject: (p, c) => `${c.money(p.balance)} at ${p.storeName} expires soon`,
  preheader: (p, c) => `Use it by ${c.date(p.expiresAt)}.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Store rewards", title: `Use your ${c.money(p.balance)} before ${c.date(p.expiresAt)}`, tone: "warn" },
    { type: "paragraph", text: `Hi ${p.firstName}, your store credit at ${p.storeName} expires soon. It's applied automatically at checkout when you buy from them.` },
    { type: "button", label: `Shop ${p.storeName}`, href: p.storeUrl },
    { type: "paragraph", muted: true, text: rules(p, c.money) },
  ],
  sample: { firstName: "Amaka", storeName: "Adire Lagos Studio", storeUrl: "https://nantty.com/@adirelagos", balance: ngn(4800), expiresAt: "2026-10-10T23:59:00.000Z" },
});

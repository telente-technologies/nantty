import * as auth from "./auth.template";
import * as buyerOrders from "./buyerOrders.template";
import * as checkmarks from "./checkmarks.template";
import * as copyright from "./copyright.template";
import * as creator from "./creator.template";
import type { EmailTemplateDefinition } from "./defineTemplate";
import * as escrow from "./escrow.template";
import * as identityVerification from "./identityVerification.template";
import * as marketing from "./marketing.template";
import * as milestones from "./milestones.template";
import * as payments from "./payments.template";
import * as privacy from "./privacy.template";
import * as sellerAccount from "./sellerAccount.template";
import * as sellerOrders from "./sellerOrders.template";
import * as social from "./social.template";
import * as storeRewards from "./storeRewards.template";
import * as subscriptionBilling from "./subscriptionBilling.template";
import * as support from "./support.template";
import * as trust from "./trust.template";

function pickTemplates<T extends Record<string, unknown>>(module: T) {
  const entries = Object.entries(module).filter(([, value]) => typeof value === "object" && value !== null && "Component" in value);
  return Object.fromEntries(entries) as { [K in keyof T as T[K] extends EmailTemplateDefinition<never> ? K : T[K] extends { Component: unknown } ? K : never]: T[K] };
}

export const emailTemplates = {
  ...pickTemplates(auth),
  ...pickTemplates(buyerOrders),
  ...pickTemplates(escrow),
  ...pickTemplates(sellerOrders),
  ...pickTemplates(sellerAccount),
  ...pickTemplates(payments),
  ...pickTemplates(subscriptionBilling),
  ...pickTemplates(storeRewards),
  ...pickTemplates(creator),
  ...pickTemplates(checkmarks),
  ...pickTemplates(identityVerification),
  ...pickTemplates(social),
  ...pickTemplates(milestones),
  ...pickTemplates(trust),
  ...pickTemplates(copyright),
  ...pickTemplates(privacy),
  ...pickTemplates(support),
  ...pickTemplates(marketing),
};

export type EmailTemplateKey = keyof typeof emailTemplates;
export type EmailTemplateProps<K extends EmailTemplateKey> = (typeof emailTemplates)[K] extends EmailTemplateDefinition<infer P> ? P : never;

export const emailTemplateKeys = Object.keys(emailTemplates) as EmailTemplateKey[];

export function readEmailTemplate<K extends EmailTemplateKey>(key: K): EmailTemplateDefinition<EmailTemplateProps<K>> {
  return emailTemplates[key] as unknown as EmailTemplateDefinition<EmailTemplateProps<K>>;
}

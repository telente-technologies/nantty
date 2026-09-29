import type { NotificationEmailSender } from "../../notifications/channels/email.channel.js";
import type { PaymentGateway } from "../../payments/gateways/paymentGateway.interface.js";
import type { AdAudiencesRepository } from "../repositories/adAudiences.repository.js";
import type { AdBillingSettingsRepository } from "../repositories/adBillingSettings.repository.js";
import type { AdToolsRepository } from "../repositories/adTools.repository.js";
import type { EngagementSource, HashedIdentifierType } from "./adAudiences.model.js";

export type BuildReportCsv = (accountId: string, breakdown: string, metrics: readonly string[], from: Date, to: Date) => Promise<string>;

export interface CustomerListMatcher {
  matchHashedIdentifiers(identifierType: HashedIdentifierType, hashes: readonly string[]): Promise<readonly { readonly hash: string; readonly userId: string }[]>;
}

export interface AudienceSizing {
  countFollowers(targetType: "user" | "store", targetId: string): Promise<number>;
  countStoreCustomers?(storeId: string, retentionDays: number, minimumOrders: number): Promise<number>;
  countEngagers?(ownerId: string, storeId: string | null, engagementSource: EngagementSource, retentionDays: number): Promise<number>;
}

export interface AdsToolsRepositories {
  readonly audiences: AdAudiencesRepository;
  readonly billingSettings: AdBillingSettingsRepository;
  readonly tools: AdToolsRepository;
}

export interface AdsToolsOptions {
  readonly buildReportCsv: BuildReportCsv;
  readonly emailSender: NotificationEmailSender;
  readonly paymentGateways?: Readonly<Record<string, PaymentGateway>>;
  readonly customerListMatcher?: CustomerListMatcher;
  readonly audienceSizing?: AudienceSizing;
  readonly billingReturnBaseUrl?: string;
}

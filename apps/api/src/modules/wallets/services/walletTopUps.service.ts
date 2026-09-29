import { randomUUID } from "node:crypto";

import { providerSupportsCurrency } from "../../../configs/currency.config.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { PaymentProvider } from "../../../enums/paymentStatus.enum.js";
import { notFound, unprocessable } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import type { MinorUnits } from "../../../types/money.type.js";
import type { PaymentGateway } from "../../payments/gateways/paymentGateway.interface.js";
import type { PaymentReturnUrls } from "../../payments/services/paymentReturnUrl.service.js";
import type { PaymentWebhookDelivery } from "../../payments/services/paymentWebhookRegistry.service.js";
import type { WalletTopUpRecord } from "../models/wallets.model.js";
import type { WalletTopUpsRepository } from "../repositories/walletTopUps.repository.js";
import { LedgerAccounts, type LedgerService } from "./ledger.service.js";

export const WALLET_TOP_UP_REFERENCE_PREFIX = "zmtop_";

export interface WalletTopUpsDependencies {
  readonly topUps: WalletTopUpsRepository;
  readonly ledger: LedgerService;
  readonly gateways: Readonly<Record<string, PaymentGateway>>;
  readonly userDirectory: UserDirectory;
  readonly returnUrls: PaymentReturnUrls;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

export interface StartedWalletTopUp {
  readonly topUp: WalletTopUpRecord;
  readonly authorizationUrl: string;
  readonly callbackUrl: string;
}

export class WalletTopUpsService {
  public constructor(private readonly dependencies: WalletTopUpsDependencies) {}

  public async startTopUp(userId: string, amount: MinorUnits, currency: CurrencyCode, provider: PaymentProvider, returnTo: string | undefined): Promise<StartedWalletTopUp> {
    const { topUps, userDirectory, returnUrls } = this.dependencies;
    const gateway = this.findGatewayOrThrow(provider);
    if (!providerSupportsCurrency(provider, currency)) throw unprocessable(`${provider} cannot charge in ${currency}. Choose another payment provider.`);
    const reference = `${WALLET_TOP_UP_REFERENCE_PREFIX}${randomUUID().replaceAll("-", "")}`;
    const callbackUrl = returnUrls.buildReturnUrlForReference(reference, returnTo);
    const topUp = await topUps.create({ userId, provider, reference, amount, currency });
    const contact = await userDirectory.findUserContact(userId);
    const initialized = await gateway.initializePayment({
      reference, amount, currency, callbackUrl, email: contact?.email ?? `user-${userId}@customers.zudomart.app`, metadata: { purpose: "wallet_top_up", topUpId: topUp.id },
    });
    await topUps.saveAuthorizationUrl(topUp.id, initialized.authorizationUrl);
    return { topUp: { ...topUp, authorizationUrl: initialized.authorizationUrl }, authorizationUrl: initialized.authorizationUrl, callbackUrl };
  }

  public async verifyTopUpForUser(userId: string, reference: string): Promise<WalletTopUpRecord> {
    const topUp = await this.dependencies.topUps.findByReference(reference);
    if (topUp === undefined || topUp.userId !== userId) throw notFound("Top-up");
    return this.confirmTopUpWithProvider(topUp);
  }

  public async handleTopUpWebhook(delivery: PaymentWebhookDelivery): Promise<void> {
    if (delivery.notice.reference === null) return;
    const topUp = await this.dependencies.topUps.findByReference(delivery.notice.reference);
    if (topUp !== undefined && topUp.provider === delivery.provider) await this.confirmTopUpWithProvider(topUp);
  }

  private async confirmTopUpWithProvider(topUp: WalletTopUpRecord): Promise<WalletTopUpRecord> {
    const { topUps, ledger, audit, clock } = this.dependencies;
    if (topUp.status !== "pending") return topUp;
    const verified = await this.findGatewayOrThrow(topUp.provider).verifyPayment(topUp.reference);
    if (verified.status === "pending") return topUp;
    if (verified.status === "failed") {
      await topUps.changeStatus(topUp.id, "pending", "failed", { providerTransactionId: verified.providerTransactionId });
      return (await topUps.findByReference(topUp.reference)) ?? topUp;
    }
    if (verified.amount !== topUp.amount || verified.currency.toUpperCase() !== topUp.currency) {
      await audit.record({ actorId: null, action: "wallets.top_up_amount_mismatch", entityType: "wallet_top_up", entityId: topUp.id, metadata: { expected: topUp.amount, received: verified.amount, currency: verified.currency } });
      throw unprocessable("The amount paid does not match this top-up.");
    }
    await ledger.postLedgerTransaction({
      reference: `wallet-top-up:${topUp.id}`,
      kind: "wallet_top_up",
      description: "Wallet top-up",
      lines: [
        { account: LedgerAccounts.providerClearing(topUp.provider, topUp.currency), direction: "debit", amount: topUp.amount, currency: topUp.currency },
        { account: LedgerAccounts.userWallet(topUp.userId, topUp.currency), direction: "credit", amount: topUp.amount, currency: topUp.currency },
      ],
    });
    if (await topUps.changeStatus(topUp.id, "pending", "succeeded", { providerTransactionId: verified.providerTransactionId, creditedAt: clock.now() })) {
      await audit.record({ actorId: topUp.userId, action: "wallets.top_up_credited", entityType: "wallet_top_up", entityId: topUp.id, metadata: { amount: topUp.amount, currency: topUp.currency, provider: topUp.provider } });
    }
    return (await topUps.findByReference(topUp.reference)) ?? topUp;
  }

  private findGatewayOrThrow(provider: string): PaymentGateway {
    const gateway = Object.hasOwn(this.dependencies.gateways, provider) ? this.dependencies.gateways[provider] : undefined;
    if (gateway === undefined) throw unprocessable("This payment provider is not supported.");
    return gateway;
  }
}

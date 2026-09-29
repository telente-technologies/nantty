import { randomUUID } from "node:crypto";

import { chooseChargeCurrencyForDisplayCurrency, providerSupportsCurrency } from "../../../configs/currency.config.js";
import type { CoinPurchaseChannel, CoinPurchasePlatform, MonetizationSettings } from "../../../configs/monetization.config.js";
import { CurrencyCode } from "../../../enums/currency.enum.js";
import type { PaymentProvider } from "../../../enums/paymentStatus.enum.js";
import { notFound, unprocessable } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import type { PaymentGateway } from "../../payments/gateways/paymentGateway.interface.js";
import type { PaymentReturnUrls } from "../../payments/services/paymentReturnUrl.service.js";
import type { PaymentWebhookDelivery } from "../../payments/services/paymentWebhookRegistry.service.js";
import { MonetizationLedgerAccounts } from "../../wallets/constants/monetizationLedgerAccounts.constant.js";
import type { LedgerAccountSpecification } from "../../wallets/models/wallets.model.js";
import { LedgerAccounts } from "../../wallets/services/ledger.service.js";
import { COIN_PURCHASE_REFERENCE_PREFIX, countCoinsInPack, type CoinPackRecord, type CoinPurchaseRecord } from "../models/coins.model.js";
import type { CoinPacksRepository } from "../repositories/coinPacks.repository.js";
import type { CoinPurchasesRepository } from "../repositories/coinPurchases.repository.js";
import type { CoinLedgerService } from "./coinLedger.service.js";
import { chooseCoinPurchaseChannel } from "./coinPurchaseChannel.service.js";

export interface CoinPurchasesDependencies {
  readonly packs: CoinPacksRepository;
  readonly purchases: CoinPurchasesRepository;
  readonly coinLedger: CoinLedgerService;
  readonly gateways: Readonly<Record<string, PaymentGateway>>;
  readonly userDirectory: UserDirectory;
  readonly returnUrls: PaymentReturnUrls;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly settings: MonetizationSettings;
}

export interface CoinPurchaseRequest {
  readonly userId: string;
  readonly packId: string;
  readonly provider: PaymentProvider;
  readonly platform: CoinPurchasePlatform;
  readonly countryCode: string | null;
  readonly displayCurrency: CurrencyCode;
  readonly returnTo: string | undefined;
}

export interface StartedCoinPurchase {
  readonly purchaseChannel: CoinPurchaseChannel;
  readonly reference: string;
  readonly authorizationUrl: string | null;
  readonly callbackUrl: string | null;
  readonly storeProductId: string | null;
  readonly purchase: CoinPurchaseRecord | null;
}

export interface VerifiedCoinPurchase {
  readonly purchase: CoinPurchaseRecord;
  readonly balance: number;
}

export function choosePackPrice(pack: CoinPackRecord, displayCurrency: CurrencyCode): { readonly amount: number; readonly currency: CurrencyCode } {
  const preferred = chooseChargeCurrencyForDisplayCurrency(displayCurrency);
  const amount = pack.prices[preferred];
  if (amount !== undefined) return { amount, currency: preferred };
  const fallback = pack.prices[CurrencyCode.USD];
  if (fallback === undefined) throw unprocessable("This coin pack has no price in your currency.");
  return { amount: fallback, currency: CurrencyCode.USD };
}

export class CoinPurchasesService {
  public constructor(public readonly dependencies: CoinPurchasesDependencies) {}

  public async findPurchasablePackOrThrow(packId: string): Promise<CoinPackRecord> {
    const pack = await this.dependencies.packs.findPack(packId);
    if (pack === undefined || !pack.active) throw notFound("Coin pack");
    return pack;
  }

  public async startPurchase(request: CoinPurchaseRequest): Promise<StartedCoinPurchase> {
    const { purchases, userDirectory, returnUrls, settings } = this.dependencies;
    const pack = await this.findPurchasablePackOrThrow(request.packId);
    const channel = chooseCoinPurchaseChannel(settings, request.platform, request.countryCode);
    if (channel === "store_iap") {
      return { purchaseChannel: channel, reference: pack.storeProductId ?? pack.id, authorizationUrl: null, callbackUrl: null, storeProductId: pack.storeProductId, purchase: null };
    }
    const price = choosePackPrice(pack, request.displayCurrency);
    if (!providerSupportsCurrency(request.provider, price.currency)) throw unprocessable(`${request.provider} cannot charge in ${price.currency}. Choose another payment provider.`);
    const reference = `${COIN_PURCHASE_REFERENCE_PREFIX}${randomUUID().replaceAll("-", "")}`;
    const callbackUrl = returnUrls.buildReturnUrlForReference(reference, request.returnTo);
    const purchase = await purchases.create({
      userId: request.userId, packId: pack.id, coins: countCoinsInPack(pack), channel, platform: request.platform, provider: request.provider, reference, amount: price.amount, currency: price.currency,
    });
    const contact = await userDirectory.findUserContact(request.userId);
    const initialized = await this.findGatewayOrThrow(request.provider).initializePayment({
      reference, amount: price.amount, currency: price.currency, callbackUrl,
      email: contact?.email ?? `user-${request.userId}@customers.zudomart.app`,
      metadata: { purpose: "coin_purchase", purchaseId: purchase.id, packId: pack.id },
    });
    await purchases.saveAuthorizationUrl(purchase.id, initialized.authorizationUrl);
    return { purchaseChannel: channel, reference, authorizationUrl: initialized.authorizationUrl, callbackUrl, storeProductId: null, purchase: { ...purchase, authorizationUrl: initialized.authorizationUrl } };
  }

  public async verifyPurchaseForUser(userId: string, reference: string): Promise<VerifiedCoinPurchase> {
    const purchase = await this.dependencies.purchases.findByReference(reference);
    if (purchase === undefined || purchase.userId !== userId) throw notFound("Coin purchase");
    const confirmed = purchase.channel === "web_checkout" ? await this.confirmPurchaseWithProvider(purchase) : purchase;
    return { purchase: confirmed, balance: await this.dependencies.coinLedger.readCoinBalance(userId) };
  }

  public async handleCoinPurchaseWebhook(delivery: PaymentWebhookDelivery): Promise<void> {
    if (delivery.notice.reference === null) return;
    const purchase = await this.dependencies.purchases.findByReference(delivery.notice.reference);
    if (purchase !== undefined && purchase.provider === delivery.provider && purchase.channel === "web_checkout") await this.confirmPurchaseWithProvider(purchase);
  }

  public async creditVerifiedPurchase(purchase: CoinPurchaseRecord, clearingAccount: LedgerAccountSpecification, providerTransactionId: string | null): Promise<CoinPurchaseRecord> {
    const { purchases, coinLedger, audit, clock } = this.dependencies;
    await coinLedger.creditCoins({
      reference: `coin-purchase:${purchase.id}`,
      kind: "coin_purchase",
      description: `Bought ${purchase.coins} coins`,
      userId: purchase.userId,
      coins: purchase.coins,
      fiatLines: [
        { account: clearingAccount, direction: "debit", amount: purchase.amount, currency: purchase.currency },
        { account: MonetizationLedgerAccounts.coinSalesRevenue(purchase.currency), direction: "credit", amount: purchase.amount, currency: purchase.currency },
      ],
    });
    if (await purchases.changeStatus(purchase.id, "pending", "succeeded", { providerTransactionId, creditedAt: clock.now() })) {
      await audit.record({
        actorId: purchase.userId, action: "coins.purchase_credited", entityType: "coin_purchase", entityId: purchase.id,
        metadata: { coins: purchase.coins, amount: purchase.amount, currency: purchase.currency, provider: purchase.provider, channel: purchase.channel },
      });
    }
    return (await purchases.findByReference(purchase.reference)) ?? purchase;
  }

  private async confirmPurchaseWithProvider(purchase: CoinPurchaseRecord): Promise<CoinPurchaseRecord> {
    const { purchases, audit } = this.dependencies;
    if (purchase.status !== "pending") return purchase;
    const verified = await this.findGatewayOrThrow(purchase.provider).verifyPayment(purchase.reference);
    if (verified.status === "pending") return purchase;
    if (verified.status === "failed") {
      await purchases.changeStatus(purchase.id, "pending", "failed", { providerTransactionId: verified.providerTransactionId });
      return (await purchases.findByReference(purchase.reference)) ?? purchase;
    }
    if (verified.amount !== purchase.amount || verified.currency.toUpperCase() !== purchase.currency) {
      await audit.record({ actorId: null, action: "coins.purchase_amount_mismatch", entityType: "coin_purchase", entityId: purchase.id, metadata: { expected: purchase.amount, received: verified.amount, currency: verified.currency } });
      throw unprocessable("The amount paid does not match this coin purchase.");
    }
    return this.creditVerifiedPurchase(purchase, LedgerAccounts.providerClearing(purchase.provider, purchase.currency), verified.providerTransactionId);
  }

  private findGatewayOrThrow(provider: string): PaymentGateway {
    const gateway = Object.hasOwn(this.dependencies.gateways, provider) ? this.dependencies.gateways[provider] : undefined;
    if (gateway === undefined) throw unprocessable("This payment provider is not supported.");
    return gateway;
  }
}

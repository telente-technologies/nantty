import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { SocialGraph } from "../interfaces/socialGraph.interface.js";
import type { UserDirectory } from "../interfaces/userDirectory.interface.js";
import { registerCoinsCommandAndQueryHandlers } from "../modules/coins/coins.module.js";
import { CoinsController } from "../modules/coins/controllers/coins.controller.js";
import { NotConfiguredStoreReceiptVerifier, type AppStoreServerApiVerifier, type GooglePlayDeveloperApiVerifier } from "../modules/coins/gateways/storeReceiptVerifier.gateway.js";
import { COIN_PURCHASE_REFERENCE_PREFIX } from "../modules/coins/models/coins.model.js";
import { PrismaCoinPacksRepository } from "../modules/coins/repositories/coinPacks.prisma.repository.js";
import { InMemoryCoinPacksRepository } from "../modules/coins/repositories/coinPacks.repository.js";
import { PrismaCoinPurchasesRepository } from "../modules/coins/repositories/coinPurchases.prisma.repository.js";
import { InMemoryCoinPurchasesRepository } from "../modules/coins/repositories/coinPurchases.repository.js";
import type { CoinLedgerService } from "../modules/coins/services/coinLedger.service.js";
import { CoinPacksService } from "../modules/coins/services/coinPacks.service.js";
import { CoinPurchasesService } from "../modules/coins/services/coinPurchases.service.js";
import { CoinWalletService } from "../modules/coins/services/coinWallet.service.js";
import { StoreReceiptsService } from "../modules/coins/services/storeReceipts.service.js";
import type { PaymentGateway } from "../modules/payments/gateways/paymentGateway.interface.js";
import type { PaymentReturnUrls } from "../modules/payments/services/paymentReturnUrl.service.js";
import type { PaymentWebhookRegistry } from "../modules/payments/services/paymentWebhookRegistry.service.js";
import type { Core } from "./core.loader.js";

export interface MonetizationExternalServices {
  readonly appStoreReceiptVerifier?: AppStoreServerApiVerifier;
  readonly googlePlayReceiptVerifier?: GooglePlayDeveloperApiVerifier;
}

export interface MonetizationPaymentServices {
  readonly gateways: Readonly<Record<string, PaymentGateway>>;
  readonly webhookRegistry: PaymentWebhookRegistry;
  readonly returnUrls: PaymentReturnUrls;
  readonly coinLedger: CoinLedgerService;
}

export interface MonetizationSharedServices {
  readonly audit: AuditRecorder;
  readonly userDirectory: UserDirectory;
  readonly socialGraph: SocialGraph;
  readonly payments: MonetizationPaymentServices;
}

export function createCoinsModule(core: Core, shared: MonetizationSharedServices, external: MonetizationExternalServices) {
  const usePrisma = core.persistence === "prisma";
  const { settings, clock, commands, queries } = core;
  const { gateways, webhookRegistry, returnUrls, coinLedger } = shared.payments;
  const packs = usePrisma ? new PrismaCoinPacksRepository() : new InMemoryCoinPacksRepository();
  const purchases = new CoinPurchasesService({
    packs,
    purchases: usePrisma ? new PrismaCoinPurchasesRepository() : new InMemoryCoinPurchasesRepository(),
    coinLedger, gateways, returnUrls, clock,
    userDirectory: shared.userDirectory,
    audit: shared.audit,
    settings: settings.monetization,
  });
  const receipts = new StoreReceiptsService(purchases, {
    apple: external.appStoreReceiptVerifier ?? new NotConfiguredStoreReceiptVerifier("apple"),
    google: external.googlePlayReceiptVerifier ?? new NotConfiguredStoreReceiptVerifier("google"),
  });
  const services = {
    purchases,
    receipts,
    wallet: new CoinWalletService(coinLedger, shared.socialGraph, shared.userDirectory, shared.audit, settings.monetization),
    packs: new CoinPacksService(packs, shared.audit, clock),
  };
  webhookRegistry.registerReferencePrefix("coin-purchases", COIN_PURCHASE_REFERENCE_PREFIX, (delivery) => purchases.handleCoinPurchaseWebhook(delivery));
  registerCoinsCommandAndQueryHandlers(commands, queries, services);
  return { coins: services, controllers: { coinsController: new CoinsController(commands, queries) } };
}

export function createMonetizationModules(core: Core, shared: MonetizationSharedServices, external: MonetizationExternalServices) {
  const coins = createCoinsModule(core, shared, external);
  return {
    scheduledJobs: [],
    controllers: { ...coins.controllers },
  };
}

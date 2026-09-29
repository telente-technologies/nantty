import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { SocialGraph } from "../interfaces/socialGraph.interface.js";
import type { CurrencyConverter } from "../interfaces/currencyConverter.interface.js";
import type { ProductCatalog } from "../interfaces/productCatalog.interface.js";
import type { UserAccountStandingLookup, UserDirectory } from "../interfaces/userDirectory.interface.js";
import type { OrdersRepository } from "../modules/orders/repositories/orders.repository.js";
import type { CheckoutDiscountSlot } from "../modules/payments/services/checkoutDiscounts.service.js";
import type { PaymentsService } from "../modules/payments/services/payments.service.js";
import { createLoyaltyModule, type LoyaltyExternalServices } from "./loyalty.loader.js";
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
import type { LedgerService } from "../modules/wallets/services/ledger.service.js";
import type { CreatorProgramServices } from "../modules/creators/services/creatorProgramServices.service.js";
import type { Core } from "./core.loader.js";
import { createCreatorSubscriptionsModule, type CreatorSubscriptionsStore } from "./creatorSubscriptions.loader.js";

export interface MonetizationExternalServices extends LoyaltyExternalServices {
  readonly appStoreReceiptVerifier?: AppStoreServerApiVerifier;
  readonly googlePlayReceiptVerifier?: GooglePlayDeveloperApiVerifier;
}

export interface MonetizationPaymentServices {
  readonly gateways: Readonly<Record<string, PaymentGateway>>;
  readonly ledger: LedgerService;
  readonly webhookRegistry: PaymentWebhookRegistry;
  readonly returnUrls: PaymentReturnUrls;
  readonly coinLedger: CoinLedgerService;
  readonly ordersRepository: OrdersRepository;
  readonly paymentsService: PaymentsService;
  readonly checkoutDiscounts: CheckoutDiscountSlot;
}

export interface MonetizationSharedServices {
  readonly audit: AuditRecorder;
  readonly userDirectory: UserDirectory & Partial<UserAccountStandingLookup>;
  readonly socialGraph: SocialGraph;
  readonly payments: MonetizationPaymentServices;
  readonly creatorSubscriptionsStore: CreatorSubscriptionsStore;
  readonly creatorProgram: CreatorProgramServices;
  readonly productCatalog: ProductCatalog;
  readonly currencyConverter: CurrencyConverter;
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
  const { gateways, webhookRegistry, returnUrls, ledger } = shared.payments;
  const creatorSubscriptions = createCreatorSubscriptionsModule(core, {
    store: shared.creatorSubscriptionsStore,
    earnings: shared.creatorProgram.creators.dependencies.earnings,
    creatorAccess: shared.creatorProgram.creators.access,
    audit: shared.audit,
    userDirectory: shared.userDirectory,
    socialGraph: shared.socialGraph,
    gateways, webhookRegistry, returnUrls, ledger,
  });
  const loyalty = createLoyaltyModule(core, {
    audit: shared.audit,
    userDirectory: shared.userDirectory,
    socialGraph: shared.socialGraph,
    productCatalog: shared.productCatalog,
    currencyConverter: shared.currencyConverter,
    ledger,
    ordersRepository: shared.payments.ordersRepository,
    paymentsService: shared.payments.paymentsService,
    checkoutDiscounts: shared.payments.checkoutDiscounts,
  }, external);
  return {
    loyalty: loyalty.loyalty,
    scheduledJobs: [...creatorSubscriptions.scheduledJobs],
    controllers: { ...coins.controllers, ...creatorSubscriptions.controllers, ...loyalty.controllers },
  };
}

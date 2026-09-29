import type { AddressBook } from "../interfaces/addressBook.interface.js";
import type { CurrencyConverter } from "../interfaces/currencyConverter.interface.js";
import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { ProductCatalog } from "../interfaces/productCatalog.interface.js";
import type { StoreAccess } from "../interfaces/storeAccess.interface.js";
import type { UserDirectory } from "../interfaces/userDirectory.interface.js";
import { registerCartsCommandAndQueryHandlers } from "../modules/carts/carts.module.js";
import { CartsController } from "../modules/carts/controllers/carts.controller.js";
import { InMemoryCartsRepository, PrismaCartsRepository } from "../modules/carts/repositories/carts.repository.js";
import { CartsService } from "../modules/carts/services/carts.service.js";
import { EscrowsController } from "../modules/escrows/controllers/escrows.controller.js";
import { registerEscrowsCommandAndQueryHandlers } from "../modules/escrows/escrows.module.js";
import { createEscrowAutoReleaseJob } from "../modules/escrows/jobs/escrowAutoRelease.job.js";
import { PrismaDisputesRepository, PrismaEscrowsRepository } from "../modules/escrows/repositories/escrows.prisma.repository.js";
import { InMemoryDisputeMessagesRepository, PrismaDisputeMessagesRepository } from "../modules/escrows/repositories/disputeMessages.repository.js";
import { InMemoryDisputesRepository, InMemoryEscrowsRepository } from "../modules/escrows/repositories/escrows.repository.js";
import { DisputeConversationService } from "../modules/escrows/services/disputeConversation.service.js";
import { DisputesService } from "../modules/escrows/services/disputes.service.js";
import { EscrowsService } from "../modules/escrows/services/escrows.service.js";
import { OrdersController } from "../modules/orders/controllers/orders.controller.js";
import { registerOrdersCommandAndQueryHandlers } from "../modules/orders/orders.module.js";
import { PrismaOrdersRepository } from "../modules/orders/repositories/orders.prisma.repository.js";
import { InMemoryOrdersRepository } from "../modules/orders/repositories/orders.repository.js";
import { RepositoryOrderLookup } from "../modules/orders/services/orderLookup.service.js";
import { OrdersService } from "../modules/orders/services/orders.service.js";
import { SellerOrdersController } from "../modules/orders/controllers/sellerOrders.controller.js";
import { StoreDashboardService } from "../modules/orders/services/storeDashboard.service.js";
import { PaymentsController } from "../modules/payments/controllers/payments.controller.js";
import { FlutterwaveGateway } from "../modules/payments/gateways/flutterwave.gateway.js";
import type { PaymentGateway } from "../modules/payments/gateways/paymentGateway.interface.js";
import { PaystackGateway } from "../modules/payments/gateways/paystack.gateway.js";
import { registerPaymentsCommandAndQueryHandlers } from "../modules/payments/payments.module.js";
import { PrismaPaymentsRepository, PrismaWebhookEventsRepository } from "../modules/payments/repositories/payments.prisma.repository.js";
import { InMemoryPaymentsRepository, InMemoryWebhookEventsRepository } from "../modules/payments/repositories/payments.repository.js";
import { CheckoutDiscountSlot } from "../modules/payments/services/checkoutDiscounts.service.js";
import { PaymentReturnUrls } from "../modules/payments/services/paymentReturnUrl.service.js";
import { PaymentWebhookRegistry } from "../modules/payments/services/paymentWebhookRegistry.service.js";
import { PaymentsService } from "../modules/payments/services/payments.service.js";
import { CoinLedgerService } from "../modules/coins/services/coinLedger.service.js";
import { WalletsController } from "../modules/wallets/controllers/wallets.controller.js";
import { PrismaLedgerRepository } from "../modules/wallets/repositories/ledger.prisma.repository.js";
import { InMemoryLedgerRepository } from "../modules/wallets/repositories/ledger.repository.js";
import { PrismaPayoutAccountsRepository, PrismaWithdrawalsRepository } from "../modules/wallets/repositories/wallets.prisma.repository.js";
import { InMemoryWalletTopUpsRepository, PrismaWalletTopUpsRepository } from "../modules/wallets/repositories/walletTopUps.repository.js";
import { InMemoryPayoutAccountsRepository, InMemoryWithdrawalsRepository } from "../modules/wallets/repositories/wallets.repository.js";
import { LedgerAdvertiserBilling } from "../modules/wallets/services/advertiserBilling.service.js";
import { LedgerCreatorWallets } from "../modules/wallets/services/creatorWallets.service.js";
import { LedgerService } from "../modules/wallets/services/ledger.service.js";
import { PaystackBankDirectory, type BankDirectory } from "../modules/wallets/services/bankDirectory.service.js";
import { PayoutTransferFeeSchedule } from "../modules/wallets/services/payoutTransferFees.service.js";
import { WalletOwnerResolver } from "../modules/wallets/services/walletOwnerResolver.service.js";
import { WALLET_TOP_UP_REFERENCE_PREFIX, WalletTopUpsService } from "../modules/wallets/services/walletTopUps.service.js";
import { WalletsService } from "../modules/wallets/services/wallets.service.js";
import { WithdrawalsService } from "../modules/wallets/services/withdrawals.service.js";
import { registerWalletsCommandAndQueryHandlers } from "../modules/wallets/wallets.module.js";
import type { Core } from "./core.loader.js";

export interface CommerceExternalServices {
  readonly paymentGateways?: Readonly<Record<"paystack" | "flutterwave", PaymentGateway>>;
  readonly bankDirectory?: BankDirectory;
}

export interface CommerceSharedServices {
  readonly addressBook: AddressBook;
  readonly currencyConverter: CurrencyConverter;
  readonly audit: AuditRecorder;
  readonly userDirectory: UserDirectory;
  readonly storeAccess: StoreAccess;
  readonly productCatalog: ProductCatalog;
}

export function createCommerceModules(core: Core, shared: CommerceSharedServices, external: CommerceExternalServices) {
  const usePrisma = core.persistence === "prisma";
  const { settings, clock, events, commands, queries, cipher } = core;
  const gateways = external.paymentGateways ?? {
    paystack: new PaystackGateway(settings.payments.paystackSecretKey),
    flutterwave: new FlutterwaveGateway(settings.payments.flutterwaveSecretKey, settings.payments.flutterwaveWebhookHash),
  };
  const ordersRepository = usePrisma ? new PrismaOrdersRepository() : new InMemoryOrdersRepository();
  const escrowsRepository = usePrisma ? new PrismaEscrowsRepository() : new InMemoryEscrowsRepository();
  const ledger = new LedgerService(usePrisma ? new PrismaLedgerRepository() : new InMemoryLedgerRepository(), clock);
  const coinLedger = new CoinLedgerService(ledger);
  const checkoutDiscounts = new CheckoutDiscountSlot();
  const webhookRegistry = new PaymentWebhookRegistry();
  const returnUrls = new PaymentReturnUrls(settings.payments.returnUrlAllowList);

  const cartsService = new CartsService({ carts: usePrisma ? new PrismaCartsRepository() : new InMemoryCartsRepository(), productCatalog: shared.productCatalog, storeAccess: shared.storeAccess, currencyConverter: shared.currencyConverter });
  const ordersService = new OrdersService({ orders: ordersRepository, addressBook: shared.addressBook, carts: cartsService, productCatalog: shared.productCatalog, storeAccess: shared.storeAccess, cipher, clock, events, currencyConverter: shared.currencyConverter });
  let paymentsService: PaymentsService | undefined;
  const escrowsService = new EscrowsService({
    escrows: escrowsRepository,
    orders: ordersRepository,
    ledger,
    storeAccess: shared.storeAccess,
    audit: shared.audit,
    events,
    clock,
    commissionBps: settings.money.commissionBps,
    inspectionDays: settings.money.escrowInspectionDays,
    paymentRefunder: { refundEscrowPayment: (escrow, chargedAmount) => (paymentsService as PaymentsService).refundEscrowPayment(escrow, chargedAmount) },
  });
  paymentsService = new PaymentsService({
    payments: usePrisma ? new PrismaPaymentsRepository() : new InMemoryPaymentsRepository(),
    webhookEvents: usePrisma ? new PrismaWebhookEventsRepository() : new InMemoryWebhookEventsRepository(),
    orders: ordersRepository,
    ordersService,
    escrowsService: () => escrowsService,
    gateways,
    userDirectory: shared.userDirectory,
    audit: shared.audit,
    events,
    clock,
    returnUrls,
    webhookRegistry,
    checkoutDiscounts,
    ledger,
  });
  const disputesService = new DisputesService(usePrisma ? new PrismaDisputesRepository() : new InMemoryDisputesRepository(), escrowsService, ordersService);
  const disputeMessages = usePrisma ? new PrismaDisputeMessagesRepository() : new InMemoryDisputeMessagesRepository();
  const conversationService = new DisputeConversationService(disputesService.disputes, disputeMessages, escrowsService);
  const bankDirectory = external.bankDirectory ?? new PaystackBankDirectory(settings.payments.paystackSecretKey);
  const owners = new WalletOwnerResolver(shared.storeAccess, bankDirectory);
  const payoutAccounts = usePrisma ? new PrismaPayoutAccountsRepository() : new InMemoryPayoutAccountsRepository();
  const walletsService = new WalletsService({
    ledger, payoutAccounts, owners, cipher, audit: shared.audit, sumEscrowHeldForStore: (storeId) => escrowsRepository.sumOutstandingForStore(storeId),
  });
  const withdrawalsService = new WithdrawalsService({
    ledger, payoutAccounts, owners, cipher, audit: shared.audit, clock, paymentGateways: gateways,
    transferFees: new PayoutTransferFeeSchedule(settings.monetization.payouts.transferFeeOverrides),
    withdrawals: usePrisma ? new PrismaWithdrawalsRepository() : new InMemoryWithdrawalsRepository(),
  });
  const topUpsService = new WalletTopUpsService({
    topUps: usePrisma ? new PrismaWalletTopUpsRepository() : new InMemoryWalletTopUpsRepository(),
    ledger, gateways, userDirectory: shared.userDirectory, returnUrls, audit: shared.audit, clock,
  });
  webhookRegistry.registerReferencePrefix("wallet-top-ups", WALLET_TOP_UP_REFERENCE_PREFIX, (delivery) => topUpsService.handleTopUpWebhook(delivery));
  const dashboardService = new StoreDashboardService(ordersRepository, shared.storeAccess, shared.productCatalog, clock);

  registerCartsCommandAndQueryHandlers(commands, queries, cartsService);
  registerOrdersCommandAndQueryHandlers(commands, queries, { orders: ordersService, dashboard: dashboardService, escrows: escrowsService, checkoutDiscounts });
  registerPaymentsCommandAndQueryHandlers(commands, queries, paymentsService, escrowsService);
  registerEscrowsCommandAndQueryHandlers(commands, queries, { escrows: escrowsService, disputes: disputesService, orders: ordersService, conversation: conversationService });
  registerWalletsCommandAndQueryHandlers(commands, queries, { wallets: walletsService, withdrawals: withdrawalsService, topUps: topUpsService });

  return {
    orderLookup: new RepositoryOrderLookup(ordersRepository),
    creatorWallets: new LedgerCreatorWallets(ledger, shared.storeAccess, coinLedger),
    advertiserBilling: new LedgerAdvertiserBilling(ledger, shared.audit),
    payments: { gateways, ledger, webhookRegistry, returnUrls, walletsService, coinLedger, paymentsService, escrowsService, ordersRepository, checkoutDiscounts },
    scheduledJobs: [createEscrowAutoReleaseJob(escrowsService)],
    controllers: {
      cartsController: new CartsController(commands, queries),
      ordersController: new OrdersController(commands, queries, ordersService, shared.currencyConverter),
      sellerOrdersController: new SellerOrdersController(commands, queries, ordersService),
      paymentsController: new PaymentsController(commands, queries, gateways),
      escrowsController: new EscrowsController(commands, queries),
      walletsController: new WalletsController(commands, queries, bankDirectory),
    },
  };
}

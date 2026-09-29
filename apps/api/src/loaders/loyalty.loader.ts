import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { CurrencyConverter } from "../interfaces/currencyConverter.interface.js";
import type { ProductCatalog } from "../interfaces/productCatalog.interface.js";
import type { ReferralFraudScreen } from "../interfaces/referralFraudScreen.interface.js";
import type { SocialGraph } from "../interfaces/socialGraph.interface.js";
import type { UserAccountStandingLookup, UserDirectory } from "../interfaces/userDirectory.interface.js";
import { EscrowReleasedEvent } from "../modules/escrows/events/escrowReleased.event.js";
import { LoyaltyController } from "../modules/loyalty/controllers/loyalty.controller.js";
import { registerLoyaltyCommandAndQueryHandlers } from "../modules/loyalty/loyalty.module.js";
import { InMemoryCashbackPromosRepository, PrismaCashbackPromosRepository } from "../modules/loyalty/repositories/cashbackPromos.repository.js";
import { PrismaLoyaltyRewardsRepository } from "../modules/loyalty/repositories/loyaltyRewards.prisma.repository.js";
import { InMemoryLoyaltyRewardsRepository } from "../modules/loyalty/repositories/loyaltyRewards.repository.js";
import { PrismaReferralsRepository } from "../modules/loyalty/repositories/referrals.prisma.repository.js";
import { InMemoryReferralsRepository } from "../modules/loyalty/repositories/referrals.repository.js";
import { CashbackService } from "../modules/loyalty/services/cashback.service.js";
import { RepositoryLoyaltyCommerceLookup } from "../modules/loyalty/services/loyaltyCommerceLookup.service.js";
import { LoyaltyPointsService } from "../modules/loyalty/services/loyaltyPoints.service.js";
import { LoyaltySummaryService } from "../modules/loyalty/services/loyaltySummary.service.js";
import { OrderRewardsService } from "../modules/loyalty/services/orderRewards.service.js";
import { ReferralsService } from "../modules/loyalty/services/referrals.service.js";
import type { OrdersRepository } from "../modules/orders/repositories/orders.repository.js";
import type { CheckoutDiscountSlot } from "../modules/payments/services/checkoutDiscounts.service.js";
import type { PaymentsService } from "../modules/payments/services/payments.service.js";
import type { LedgerService } from "../modules/wallets/services/ledger.service.js";
import type { Core } from "./core.loader.js";
import { subscribeToEvent } from "./events.loader.js";

export interface LoyaltyExternalServices {
  readonly referralFraudScreen?: ReferralFraudScreen;
}

export interface LoyaltySharedServices {
  readonly audit: AuditRecorder;
  readonly userDirectory: UserDirectory & Partial<UserAccountStandingLookup>;
  readonly socialGraph: SocialGraph;
  readonly productCatalog: ProductCatalog;
  readonly currencyConverter: CurrencyConverter;
  readonly ledger: LedgerService;
  readonly ordersRepository: OrdersRepository;
  readonly paymentsService: PaymentsService;
  readonly checkoutDiscounts: CheckoutDiscountSlot;
}

export function createLoyaltyModule(core: Core, shared: LoyaltySharedServices, external: LoyaltyExternalServices) {
  const usePrisma = core.persistence === "prisma";
  const dependencies = {
    ledger: shared.ledger,
    rewards: usePrisma ? new PrismaLoyaltyRewardsRepository() : new InMemoryLoyaltyRewardsRepository(),
    commerce: new RepositoryLoyaltyCommerceLookup(shared.ordersRepository, shared.paymentsService.dependencies.payments, shared.productCatalog),
    audit: shared.audit,
    clock: core.clock,
    settings: core.settings.monetization,
  };
  const points = new LoyaltyPointsService(dependencies);
  const cashback = new CashbackService(dependencies, usePrisma ? new PrismaCashbackPromosRepository() : new InMemoryCashbackPromosRepository());
  const referrals = new ReferralsService(dependencies, {
    referrals: usePrisma ? new PrismaReferralsRepository() : new InMemoryReferralsRepository(),
    userDirectory: shared.userDirectory,
    socialGraph: shared.socialGraph,
    fraudScreen: external.referralFraudScreen,
  });
  const orderRewards = new OrderRewardsService(points, cashback, referrals, core.logger);
  const services = { points, cashback, referrals, orderRewards, summary: new LoyaltySummaryService(points, referrals, shared.currencyConverter) };
  shared.checkoutDiscounts.attachSource(orderRewards);
  subscribeToEvent(core.events, EscrowReleasedEvent, async ({ orderId }) => {
    await orderRewards.rewardReleasedOrder(orderId);
  });
  registerLoyaltyCommandAndQueryHandlers(core.commands, core.queries, services);
  return { loyalty: services, controllers: { loyaltyController: new LoyaltyController(core.commands, core.queries) } };
}

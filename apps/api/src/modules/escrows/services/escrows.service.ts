import type { EventBus } from "@zudojs/events";

import type { EscrowStatus } from "../../../enums/escrowStatus.enum.js";
import { invalidState, notFound } from "../../../errors/domain.error.js";
import { NotificationRequestedEvent } from "../../../events/notificationRequested.event.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import { calculateBasisPointsShare } from "../../../utils/money.util.js";
import type { OrderRecord } from "../../orders/models/orders.model.js";
import type { OrdersRepository } from "../../orders/repositories/orders.repository.js";
import { LedgerAccounts, type LedgerService } from "../../wallets/services/ledger.service.js";
import { EscrowHeldEvent, EscrowRefundedEvent, EscrowReleasedEvent } from "../events/escrowReleased.event.js";
import type { EscrowRecord } from "../models/escrows.model.js";
import type { EscrowsRepository } from "../repositories/escrows.repository.js";

export type EscrowReleaseTrigger = "buyer_confirmed" | "auto_release" | "dispute_resolved";

export interface EscrowPaymentRefunder {
  refundEscrowPayment(escrow: EscrowRecord): Promise<{ readonly provider: string }>;
}

export interface EscrowsDependencies {
  readonly escrows: EscrowsRepository;
  readonly orders: OrdersRepository;
  readonly ledger: LedgerService;
  readonly storeAccess: StoreAccess;
  readonly audit: AuditRecorder;
  readonly events: EventBus;
  readonly clock: Clock;
  readonly commissionBps: number;
  readonly inspectionDays: number;
  readonly paymentRefunder: EscrowPaymentRefunder;
}

const AUTO_RELEASE_BATCH_SIZE = 100;
const DAY_MILLISECONDS = 86_400_000;

function describeEscrow(escrow: EscrowRecord) {
  return { escrowId: escrow.id, orderId: escrow.orderId, storeId: escrow.storeId, amount: escrow.amount };
}

export class EscrowsService {
  public constructor(public readonly dependencies: EscrowsDependencies) {}

  public async holdEscrowsForPaidOrders(paymentId: string, provider: string, orders: readonly OrderRecord[]): Promise<void> {
    const { escrows, ledger, clock, events } = this.dependencies;
    for (const order of orders) {
      const { escrow, created } = await escrows.createHeldEscrow({
        orderId: order.id, paymentId, storeId: order.storeId, buyerId: order.buyerId, amount: order.total, currency: order.currency, heldAt: clock.now(),
      });
      await ledger.postLedgerTransaction({
        reference: `escrow-hold:${order.id}`,
        kind: "escrow_hold",
        description: `Buyer payment for order ${order.number} held in escrow`,
        currency: order.currency,
        lines: [
          { account: LedgerAccounts.providerClearing(provider), direction: "debit", amount: order.total },
          { account: LedgerAccounts.orderEscrow(order.id), direction: "credit", amount: order.total },
        ],
      });
      if (created) await publishEvent(events, EscrowHeldEvent, describeEscrow(escrow));
    }
  }

  public async findEscrowForOrder(orderId: string): Promise<EscrowRecord> {
    const escrow = await this.dependencies.escrows.findByOrderId(orderId);
    if (escrow === undefined) throw notFound("Escrow");
    return escrow;
  }

  public async scheduleAutomaticRelease(orderId: string, deliveredAt: Date): Promise<void> {
    await this.dependencies.escrows.scheduleRelease(orderId, new Date(deliveredAt.getTime() + this.dependencies.inspectionDays * DAY_MILLISECONDS));
  }

  public async releaseEscrowFundsToSellerWallet(escrow: EscrowRecord, trigger: EscrowReleaseTrigger, actorId: string | null): Promise<EscrowRecord> {
    const { escrows, ledger, orders, audit, clock, events, commissionBps } = this.dependencies;
    const from: readonly EscrowStatus[] = trigger === "dispute_resolved" ? ["disputed"] : ["held"];
    const released = await escrows.transitionStatus(escrow.id, from, "released", { releasedAt: clock.now() });
    if (released === undefined) throw invalidState("This escrow can no longer be released.");
    const commission = calculateBasisPointsShare(escrow.amount, commissionBps);
    const sellerShare = escrow.amount - commission;
    try {
      await ledger.postLedgerTransaction({
        reference: `escrow-release:${escrow.id}`,
        kind: "escrow_release",
        description: `Escrow for order ${escrow.orderId} released (${trigger})`,
        currency: escrow.currency,
        lines: [
          { account: LedgerAccounts.orderEscrow(escrow.orderId), direction: "debit", amount: escrow.amount },
          ...(sellerShare > 0 ? [{ account: LedgerAccounts.storeWallet(escrow.storeId), direction: "credit" as const, amount: sellerShare }] : []),
          ...(commission > 0 ? [{ account: LedgerAccounts.platformCommission(), direction: "credit" as const, amount: commission }] : []),
        ],
      });
    } catch (error) {
      await escrows.transitionStatus(escrow.id, ["released"], escrow.status, {});
      throw error;
    }
    await orders.transitionStatus(escrow.orderId, ["paid", "shipped", "delivered", "disputed"], "completed", { completedAt: clock.now() });
    await audit.record({ actorId, action: "escrows.released", entityType: "escrow", entityId: escrow.id, metadata: { orderId: escrow.orderId, trigger, amount: escrow.amount, commission } });
    await this.notifyStoreOwner(escrow.storeId, "Funds released", `Your earnings for an order are now in your wallet.`, escrow.orderId);
    await publishEvent(events, EscrowReleasedEvent, describeEscrow(released));
    return released;
  }

  public async refundEscrowToBuyer(escrow: EscrowRecord, actorId: string, from: readonly EscrowStatus[]): Promise<EscrowRecord> {
    const { escrows, ledger, orders, audit, clock, events, paymentRefunder } = this.dependencies;
    const refunded = await escrows.transitionStatus(escrow.id, from, "refunded", { refundedAt: clock.now() });
    if (refunded === undefined) throw invalidState("This escrow can no longer be refunded.");
    let provider: string;
    try {
      provider = (await paymentRefunder.refundEscrowPayment(escrow)).provider;
    } catch (error) {
      await escrows.transitionStatus(escrow.id, ["refunded"], escrow.status, {});
      throw error;
    }
    await ledger.postLedgerTransaction({
      reference: `escrow-refund:${escrow.id}`,
      kind: "escrow_refund",
      description: `Escrow for order ${escrow.orderId} refunded to the buyer`,
      currency: escrow.currency,
      lines: [
        { account: LedgerAccounts.orderEscrow(escrow.orderId), direction: "debit", amount: escrow.amount },
        { account: LedgerAccounts.providerClearing(provider), direction: "credit", amount: escrow.amount },
      ],
    });
    await orders.transitionStatus(escrow.orderId, ["paid", "shipped", "delivered", "disputed"], "refunded", {});
    await audit.record({ actorId, action: "escrows.refunded", entityType: "escrow", entityId: escrow.id, metadata: { orderId: escrow.orderId, amount: escrow.amount } });
    await publishEvent(events, NotificationRequestedEvent, {
      userId: escrow.buyerId, category: "payments", title: "Refund issued", body: "Your payment for an order has been refunded.", data: { orderId: escrow.orderId },
    });
    await publishEvent(events, EscrowRefundedEvent, describeEscrow(refunded));
    return refunded;
  }

  public async releaseEscrowsPastInspectionPeriod(): Promise<number> {
    const due = await this.dependencies.escrows.listDueForRelease(this.dependencies.clock.now(), AUTO_RELEASE_BATCH_SIZE);
    let releasedCount = 0;
    for (const escrow of due) {
      try {
        await this.releaseEscrowFundsToSellerWallet(escrow, "auto_release", null);
        releasedCount += 1;
      } catch {
        continue;
      }
    }
    return releasedCount;
  }

  public async notifyStoreOwner(storeId: string, title: string, body: string, orderId: string): Promise<void> {
    const [store] = await this.dependencies.storeAccess.findStoreSummaries([storeId]);
    if (store === undefined) return;
    await publishEvent(this.dependencies.events, NotificationRequestedEvent, { userId: store.ownerId, category: "orders", title, body, data: { orderId } });
  }
}

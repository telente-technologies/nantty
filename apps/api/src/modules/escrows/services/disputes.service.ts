import { invalidState, notFound } from "../../../errors/domain.error.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import type { OrdersService } from "../../orders/services/orders.service.js";
import { EscrowDisputedEvent } from "../events/escrowReleased.event.js";
import type { DisputeRecord, DisputeStatus } from "../models/escrows.model.js";
import type { DisputesRepository } from "../repositories/escrows.repository.js";
import type { EscrowsService } from "./escrows.service.js";

export type DisputeOutcome = "release" | "refund";

export class DisputesService {
  public constructor(
    public readonly disputes: DisputesRepository,
    private readonly escrowsService: EscrowsService,
    private readonly ordersService: OrdersService,
  ) {}

  public async openDisputeForOrder(buyerId: string, orderId: string, reason: string, details: string): Promise<DisputeRecord> {
    const { escrows, orders, clock } = this.escrowsService.dependencies;
    const order = await this.ordersService.findOrderForBuyer(buyerId, orderId);
    const escrow = await escrows.findByOrderId(order.id);
    if (escrow === undefined) throw invalidState("Only paid orders can be disputed.");
    const disputed = await escrows.transitionStatus(escrow.id, ["held"], "disputed", {});
    if (disputed === undefined) throw invalidState("This order can no longer be disputed.");
    await orders.transitionStatus(order.id, ["paid", "shipped", "delivered"], "disputed", {});
    const dispute = await this.disputes.create({ escrowId: escrow.id, orderId: order.id, openedById: buyerId, reason, details, createdAt: clock.now() });
    await this.escrowsService.notifyStoreOwner(order.storeId, "Order disputed", `The buyer opened a dispute on order ${order.number}. Funds are on hold.`, order.id);
    await publishEvent(this.escrowsService.dependencies.events, EscrowDisputedEvent, { escrowId: escrow.id, orderId: order.id, storeId: order.storeId, amount: escrow.amount });
    return dispute;
  }

  public listDisputes(status: DisputeStatus | undefined, page: PageRequest): Promise<Page<DisputeRecord>> {
    return this.disputes.list(status, page);
  }

  public async resolveDispute(adminId: string, disputeId: string, outcome: DisputeOutcome, note: string): Promise<DisputeRecord> {
    const { escrows, clock, audit } = this.escrowsService.dependencies;
    const dispute = await this.disputes.findById(disputeId);
    if (dispute === undefined) throw notFound("Dispute");
    if (dispute.status !== "open") throw invalidState("This dispute has already been resolved.");
    const escrow = await escrows.findById(dispute.escrowId);
    if (escrow === undefined) throw notFound("Escrow");
    if (outcome === "release") {
      await this.escrowsService.releaseEscrowFundsToSellerWallet(escrow, "dispute_resolved", adminId);
    } else {
      await this.escrowsService.refundEscrowToBuyer(escrow, adminId, ["disputed"]);
    }
    const resolved = await this.disputes.resolve(dispute.id, outcome === "release" ? "resolved_release" : "resolved_refund", note, adminId, clock.now());
    if (resolved === undefined) throw invalidState("This dispute has already been resolved.");
    await audit.record({ actorId: adminId, action: "escrows.dispute_resolved", entityType: "dispute", entityId: dispute.id, metadata: { outcome, orderId: dispute.orderId } });
    return resolved;
  }
}

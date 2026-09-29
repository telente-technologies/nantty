import { rolesGrantPermission } from "../../../constants/permissions.constant.js";
import { invalidState, notFound } from "../../../errors/domain.error.js";
import { NotificationRequestedEvent } from "../../../events/notificationRequested.event.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import type { OrderRecord } from "../../orders/models/orders.model.js";
import type { DisputeMessageRecord, DisputeParticipantRole, DisputeRecord } from "../models/escrows.model.js";
import type { DisputeMessagesRepository } from "../repositories/disputeMessages.repository.js";
import type { DisputesRepository } from "../repositories/escrows.repository.js";
import type { EscrowsService } from "./escrows.service.js";

export interface DisputeForViewer {
  readonly dispute: DisputeRecord;
  readonly order: OrderRecord;
  readonly viewerRole: DisputeParticipantRole;
}

export class DisputeConversationService {
  public constructor(
    private readonly disputes: DisputesRepository,
    private readonly messages: DisputeMessagesRepository,
    private readonly escrowsService: EscrowsService,
  ) {}

  public async findDisputeForViewer(principal: Principal, disputeId: string): Promise<DisputeForViewer> {
    const { orders, storeAccess } = this.escrowsService.dependencies;
    const dispute = await this.disputes.findById(disputeId);
    if (dispute === undefined) throw notFound("Dispute");
    const order = await orders.findById(dispute.orderId);
    if (order === undefined) throw notFound("Dispute");
    if (order.buyerId === principal.userId) return { dispute, order, viewerRole: "buyer" };
    if ((await storeAccess.listStoreIdsForMember(principal.userId)).includes(order.storeId)) return { dispute, order, viewerRole: "seller" };
    if (rolesGrantPermission(principal.roles, "disputes:resolve")) return { dispute, order, viewerRole: "admin" };
    throw notFound("Dispute");
  }

  public async listDisputeMessages(principal: Principal, disputeId: string): Promise<readonly DisputeMessageRecord[]> {
    const { dispute } = await this.findDisputeForViewer(principal, disputeId);
    return this.messages.listForDispute(dispute.id);
  }

  public async postDisputeMessage(principal: Principal, disputeId: string, text: string, attachmentMediaIds: readonly string[]): Promise<DisputeMessageRecord> {
    const { dispute, order, viewerRole } = await this.findDisputeForViewer(principal, disputeId);
    if (dispute.status !== "open") throw invalidState("This dispute is closed.");
    const message = await this.messages.create({
      disputeId: dispute.id,
      authorId: principal.userId,
      authorRole: viewerRole,
      text: text.trim(),
      attachmentMediaIds,
      createdAt: this.escrowsService.dependencies.clock.now(),
    });
    await this.notifyOtherParticipants(order, viewerRole, dispute.id);
    return message;
  }

  private async notifyOtherParticipants(order: OrderRecord, authorRole: DisputeParticipantRole, disputeId: string): Promise<void> {
    const body = `There is a new message on the dispute for order ${order.number}.`;
    if (authorRole !== "buyer") {
      await publishEvent(this.escrowsService.dependencies.events, NotificationRequestedEvent, {
        userId: order.buyerId, category: "orders", title: "Dispute update", body, data: { orderId: order.id, disputeId },
      });
    }
    if (authorRole !== "seller") await this.escrowsService.notifyStoreOwner(order.storeId, "Dispute update", body, order.id);
  }
}

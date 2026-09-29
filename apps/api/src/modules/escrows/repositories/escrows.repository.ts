import { randomUUID } from "node:crypto";

import type { EscrowStatus } from "../../../enums/escrowStatus.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type { DisputeRecord, DisputeStatus, EscrowRecord, EscrowStatusChange, NewDispute, NewEscrow } from "../models/escrows.model.js";

export interface EscrowsRepository {
  createHeldEscrow(input: NewEscrow): Promise<{ readonly escrow: EscrowRecord; readonly created: boolean }>;
  findById(escrowId: string): Promise<EscrowRecord | undefined>;
  findByOrderId(orderId: string): Promise<EscrowRecord | undefined>;
  transitionStatus(escrowId: string, from: readonly EscrowStatus[], to: EscrowStatus, change: EscrowStatusChange): Promise<EscrowRecord | undefined>;
  scheduleRelease(orderId: string, releaseAfter: Date): Promise<void>;
  listDueForRelease(now: Date, limit: number): Promise<readonly EscrowRecord[]>;
  sumOutstandingForStore(storeId: string): Promise<MinorUnits>;
}

export interface DisputesRepository {
  create(input: NewDispute): Promise<DisputeRecord>;
  findById(disputeId: string): Promise<DisputeRecord | undefined>;
  findOpenForEscrow(escrowId: string): Promise<DisputeRecord | undefined>;
  list(status: DisputeStatus | undefined, page: PageRequest): Promise<Page<DisputeRecord>>;
  resolve(disputeId: string, status: DisputeStatus, resolution: string, resolvedById: string, resolvedAt: Date): Promise<DisputeRecord | undefined>;
}

export class InMemoryEscrowsRepository implements EscrowsRepository {
  private readonly escrows = new Map<string, EscrowRecord>();

  public async createHeldEscrow(input: NewEscrow) {
    const existing = [...this.escrows.values()].find((escrow) => escrow.orderId === input.orderId);
    if (existing !== undefined) return { escrow: existing, created: false };
    const escrow: EscrowRecord = { ...input, id: randomUUID(), status: "held", releaseAfter: null, releasedAt: null, refundedAt: null, version: 0 };
    this.escrows.set(escrow.id, escrow);
    return { escrow, created: true };
  }

  public async findById(escrowId: string): Promise<EscrowRecord | undefined> {
    return this.escrows.get(escrowId);
  }

  public async findByOrderId(orderId: string): Promise<EscrowRecord | undefined> {
    return [...this.escrows.values()].find((escrow) => escrow.orderId === orderId);
  }

  public async transitionStatus(escrowId: string, from: readonly EscrowStatus[], to: EscrowStatus, change: EscrowStatusChange): Promise<EscrowRecord | undefined> {
    const escrow = this.escrows.get(escrowId);
    if (escrow === undefined || !from.includes(escrow.status)) return undefined;
    const updated: EscrowRecord = { ...escrow, ...change, status: to, version: escrow.version + 1 };
    this.escrows.set(escrowId, updated);
    return updated;
  }

  public async scheduleRelease(orderId: string, releaseAfter: Date): Promise<void> {
    const escrow = await this.findByOrderId(orderId);
    if (escrow?.status === "held") this.escrows.set(escrow.id, { ...escrow, releaseAfter });
  }

  public async listDueForRelease(now: Date, limit: number): Promise<readonly EscrowRecord[]> {
    return [...this.escrows.values()]
      .filter((escrow) => escrow.status === "held" && escrow.releaseAfter !== null && escrow.releaseAfter <= now)
      .slice(0, limit);
  }

  public async sumOutstandingForStore(storeId: string): Promise<MinorUnits> {
    return [...this.escrows.values()]
      .filter((escrow) => escrow.storeId === storeId && (escrow.status === "held" || escrow.status === "disputed"))
      .reduce((total, escrow) => total + escrow.amount, 0);
  }
}

export class InMemoryDisputesRepository implements DisputesRepository {
  private readonly disputes = new Map<string, DisputeRecord>();

  public async create(input: NewDispute): Promise<DisputeRecord> {
    const dispute: DisputeRecord = { ...input, id: randomUUID(), status: "open", resolution: null, resolvedById: null, resolvedAt: null };
    this.disputes.set(dispute.id, dispute);
    return dispute;
  }

  public async findById(disputeId: string): Promise<DisputeRecord | undefined> {
    return this.disputes.get(disputeId);
  }

  public async findOpenForEscrow(escrowId: string): Promise<DisputeRecord | undefined> {
    return [...this.disputes.values()].find((dispute) => dispute.escrowId === escrowId && dispute.status === "open");
  }

  public async list(status: DisputeStatus | undefined, page: PageRequest): Promise<Page<DisputeRecord>> {
    const items = [...this.disputes.values()].filter((dispute) => status === undefined || dispute.status === status).sort(compareByNewestFirst);
    return paginateSortedItems(items, page);
  }

  public async resolve(disputeId: string, status: DisputeStatus, resolution: string, resolvedById: string, resolvedAt: Date): Promise<DisputeRecord | undefined> {
    const dispute = this.disputes.get(disputeId);
    if (dispute?.status !== "open") return undefined;
    const resolved: DisputeRecord = { ...dispute, status, resolution, resolvedById, resolvedAt };
    this.disputes.set(disputeId, resolved);
    return resolved;
  }
}

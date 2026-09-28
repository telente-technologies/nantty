import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type { NewSellerApplicationInput, SellerApplicationRecord, SellerApplicationStatus } from "../models/stores.model.js";

export interface SellerApplicationReview {
  readonly status: Exclude<SellerApplicationStatus, "pending">;
  readonly reviewerId: string;
  readonly reviewNote: string | null;
  readonly reviewedAt: Date;
}

export interface SellerApplicationsRepository {
  create(input: NewSellerApplicationInput): Promise<SellerApplicationRecord>;
  findById(id: string): Promise<SellerApplicationRecord | undefined>;
  listForUser(userId: string): Promise<readonly SellerApplicationRecord[]>;
  list(status: SellerApplicationStatus | undefined, page: PageRequest): Promise<Page<SellerApplicationRecord>>;
  markReviewedIfPending(id: string, review: SellerApplicationReview): Promise<boolean>;
}

export class InMemorySellerApplicationsRepository implements SellerApplicationsRepository {
  private readonly applications = new Map<string, SellerApplicationRecord>();

  public async create(input: NewSellerApplicationInput): Promise<SellerApplicationRecord> {
    const record: SellerApplicationRecord = {
      ...input, id: randomUUID(), status: "pending", reviewerId: null, reviewNote: null, reviewedAt: null, createdAt: new Date(),
    };
    this.applications.set(record.id, record);
    return record;
  }

  public async findById(id: string): Promise<SellerApplicationRecord | undefined> {
    return this.applications.get(id);
  }

  public async listForUser(userId: string): Promise<readonly SellerApplicationRecord[]> {
    return [...this.applications.values()].filter((application) => application.userId === userId).sort(compareByNewestFirst);
  }

  public async list(status: SellerApplicationStatus | undefined, page: PageRequest): Promise<Page<SellerApplicationRecord>> {
    const matches = [...this.applications.values()]
      .filter((application) => status === undefined || application.status === status)
      .sort(compareByNewestFirst);
    return paginateSortedItems(matches, page);
  }

  public async markReviewedIfPending(id: string, review: SellerApplicationReview): Promise<boolean> {
    const application = this.applications.get(id);
    if (application === undefined || application.status !== "pending") return false;
    this.applications.set(id, { ...application, ...review });
    return true;
  }
}

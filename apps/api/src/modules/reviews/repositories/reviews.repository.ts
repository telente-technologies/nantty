import { randomUUID } from "node:crypto";

import { ConflictError } from "@zudojs/errors";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import { summarizeRatingCounts, type NewReviewInput, type RatingSummary, type ReviewRecord } from "../models/reviews.model.js";

export type ReviewSubject = { readonly productId: string } | { readonly storeId: string };

export interface ReviewsRepository {
  create(input: NewReviewInput): Promise<ReviewRecord>;
  findById(id: string): Promise<ReviewRecord | undefined>;
  delete(id: string): Promise<boolean>;
  saveReply(id: string, reply: string, repliedAt: Date): Promise<ReviewRecord | undefined>;
  list(subject: ReviewSubject, page: PageRequest): Promise<Page<ReviewRecord>>;
  summarize(subject: ReviewSubject): Promise<RatingSummary>;
}

export const DUPLICATE_REVIEW_MESSAGE = "You have already reviewed this product for this order.";

function reviewMatchesSubject(review: ReviewRecord, subject: ReviewSubject): boolean {
  return "productId" in subject ? review.productId === subject.productId : review.storeId === subject.storeId;
}

export class InMemoryReviewsRepository implements ReviewsRepository {
  private readonly reviews = new Map<string, ReviewRecord>();

  public async create(input: NewReviewInput): Promise<ReviewRecord> {
    const duplicate = [...this.reviews.values()].some(
      (review) => review.userId === input.userId && review.orderId === input.orderId && review.productId === input.productId,
    );
    if (duplicate) throw new ConflictError(DUPLICATE_REVIEW_MESSAGE);
    const review: ReviewRecord = { ...input, id: randomUUID(), reply: null, repliedAt: null };
    this.reviews.set(review.id, review);
    return review;
  }

  public async findById(id: string): Promise<ReviewRecord | undefined> {
    return this.reviews.get(id);
  }

  public async delete(id: string): Promise<boolean> {
    return this.reviews.delete(id);
  }

  public async saveReply(id: string, reply: string, repliedAt: Date): Promise<ReviewRecord | undefined> {
    const review = this.reviews.get(id);
    if (review === undefined) return undefined;
    const updated = { ...review, reply, repliedAt };
    this.reviews.set(id, updated);
    return updated;
  }

  public async list(subject: ReviewSubject, page: PageRequest): Promise<Page<ReviewRecord>> {
    const matches = [...this.reviews.values()].filter((review) => reviewMatchesSubject(review, subject)).sort(compareByNewestFirst);
    return paginateSortedItems(matches, page);
  }

  public async summarize(subject: ReviewSubject): Promise<RatingSummary> {
    const counts = new Map<number, number>();
    for (const review of this.reviews.values()) {
      if (reviewMatchesSubject(review, subject)) counts.set(review.rating, (counts.get(review.rating) ?? 0) + 1);
    }
    return summarizeRatingCounts(counts);
  }
}

export interface ReviewRecord {
  readonly id: string;
  readonly productId: string;
  readonly storeId: string;
  readonly orderId: string;
  readonly userId: string;
  readonly rating: number;
  readonly text: string;
  readonly reply: string | null;
  readonly repliedAt: Date | null;
  readonly createdAt: Date;
}

export type NewReviewInput = Omit<ReviewRecord, "id" | "reply" | "repliedAt">;

export interface RatingSummary {
  readonly average: number;
  readonly count: number;
  readonly distribution: Readonly<Record<"1" | "2" | "3" | "4" | "5", number>>;
}

export function summarizeRatingCounts(countsByRating: ReadonlyMap<number, number>): RatingSummary {
  const distribution = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  let count = 0;
  let total = 0;
  for (const [rating, ratingCount] of countsByRating) {
    const key = String(rating) as keyof typeof distribution;
    if (!(key in distribution)) continue;
    distribution[key] += ratingCount;
    count += ratingCount;
    total += rating * ratingCount;
  }
  return { average: count === 0 ? 0 : Math.round((total / count) * 10) / 10, count, distribution };
}

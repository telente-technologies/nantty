import { ConflictError } from "@zudojs/errors";

import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments } from "../../../utils/pagination.util.js";
import { summarizeRatingCounts, type NewReviewInput, type RatingSummary, type ReviewRecord } from "../models/reviews.model.js";
import { DUPLICATE_REVIEW_MESSAGE, type ReviewSubject, type ReviewsRepository } from "./reviews.repository.js";

export class PrismaReviewsRepository implements ReviewsRepository {
  public async create(input: NewReviewInput): Promise<ReviewRecord> {
    try {
      return await prisma().review.create({ data: { ...input } });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new ConflictError(DUPLICATE_REVIEW_MESSAGE);
      throw error;
    }
  }

  public async findById(id: string): Promise<ReviewRecord | undefined> {
    return (await prisma().review.findUnique({ where: { id } })) ?? undefined;
  }

  public async delete(id: string): Promise<boolean> {
    return (await prisma().review.deleteMany({ where: { id } })).count > 0;
  }

  public async saveReply(id: string, reply: string, repliedAt: Date): Promise<ReviewRecord | undefined> {
    const result = await prisma().review.updateMany({ where: { id }, data: { reply, repliedAt } });
    return result.count === 0 ? undefined : this.findById(id);
  }

  public async list(subject: ReviewSubject, page: PageRequest): Promise<Page<ReviewRecord>> {
    const rows = await prisma().review.findMany({
      where: { ...subject },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return buildPageFromFetchedRows(rows, page);
  }

  public async summarize(subject: ReviewSubject): Promise<RatingSummary> {
    const groups = await prisma().review.groupBy({ by: ["rating"], where: { ...subject }, _count: { _all: true } });
    return summarizeRatingCounts(new Map(groups.map((group) => [group.rating, group._count._all])));
  }
}

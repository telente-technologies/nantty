import { reportsPerHourLimit } from "../../../constants/social.constant.js";
import { tooManyRequests } from "../../../errors/social.error.js";
import type { Db } from "../../../types/database.type.js";
import { reportIntakeRepository } from "../repositories/reportIntake.repository.js";

export async function lockAndCheckReportRateLimit(db: Db, reporterId: string, since: Date): Promise<void> {
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${reporterId}, 0))`;
  const reportCount = await reportIntakeRepository.countSince(db, reporterId, since);
  if (reportCount >= reportsPerHourLimit) {
    throw tooManyRequests("REPORT_RATE_LIMITED", "You've sent too many reports. Try again later.");
  }
}

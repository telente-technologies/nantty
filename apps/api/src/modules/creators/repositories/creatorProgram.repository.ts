import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type {
  CreatorApplicationRecord,
  CreatorApplicationStatus,
  CreatorEligibility,
  CreatorProfileRecord,
  CreatorViolationRecord,
} from "../models/creators.model.js";

export interface NewCreatorApplication {
  readonly userId: string;
  readonly eligibility: CreatorEligibility;
  readonly createdAt: Date;
}

export interface CreatorApplicationReview {
  readonly status: Exclude<CreatorApplicationStatus, "pending">;
  readonly reviewerId: string;
  readonly reviewNote: string | null;
  readonly reviewedAt: Date;
}

export type NewCreatorViolation = Omit<CreatorViolationRecord, "id">;

export interface CreatorProgramRepository {
  createApplication(input: NewCreatorApplication): Promise<CreatorApplicationRecord>;
  findApplication(applicationId: string): Promise<CreatorApplicationRecord | undefined>;
  findLatestApplicationForUser(userId: string): Promise<CreatorApplicationRecord | undefined>;
  listApplications(status: CreatorApplicationStatus | undefined, page: PageRequest): Promise<Page<CreatorApplicationRecord>>;
  markApplicationReviewedIfPending(applicationId: string, review: CreatorApplicationReview): Promise<boolean>;
  findProfile(userId: string): Promise<CreatorProfileRecord | undefined>;
  saveProfile(profile: CreatorProfileRecord): Promise<void>;
  recordViolation(violation: NewCreatorViolation): Promise<void>;
  countViolationsSince(userId: string, since: Date): Promise<number>;
}

export class InMemoryCreatorProgramRepository implements CreatorProgramRepository {
  private readonly applications = new Map<string, CreatorApplicationRecord>();
  private readonly profiles = new Map<string, CreatorProfileRecord>();
  private readonly violations: CreatorViolationRecord[] = [];

  public async createApplication(input: NewCreatorApplication): Promise<CreatorApplicationRecord> {
    const application: CreatorApplicationRecord = { ...input, id: randomUUID(), status: "pending", reviewerId: null, reviewNote: null, reviewedAt: null };
    this.applications.set(application.id, application);
    return application;
  }

  public async findApplication(applicationId: string): Promise<CreatorApplicationRecord | undefined> {
    return this.applications.get(applicationId);
  }

  public async findLatestApplicationForUser(userId: string): Promise<CreatorApplicationRecord | undefined> {
    return [...this.applications.values()].filter((application) => application.userId === userId).sort(compareByNewestFirst)[0];
  }

  public async listApplications(status: CreatorApplicationStatus | undefined, page: PageRequest): Promise<Page<CreatorApplicationRecord>> {
    const matches = [...this.applications.values()].filter((application) => status === undefined || application.status === status);
    return paginateSortedItems(matches.sort(compareByNewestFirst), page);
  }

  public async markApplicationReviewedIfPending(applicationId: string, review: CreatorApplicationReview): Promise<boolean> {
    const application = this.applications.get(applicationId);
    if (application === undefined || application.status !== "pending") return false;
    this.applications.set(applicationId, { ...application, ...review });
    return true;
  }

  public async findProfile(userId: string): Promise<CreatorProfileRecord | undefined> {
    return this.profiles.get(userId);
  }

  public async saveProfile(profile: CreatorProfileRecord): Promise<void> {
    this.profiles.set(profile.userId, profile);
  }

  public async recordViolation(violation: NewCreatorViolation): Promise<void> {
    this.violations.push({ ...violation, id: randomUUID() });
  }

  public async countViolationsSince(userId: string, since: Date): Promise<number> {
    return this.violations.filter((violation) => violation.userId === userId && violation.createdAt >= since).length;
  }
}

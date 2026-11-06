export type ReengagementStatus = "pending" | "dispatching" | "sent" | "skipped" | "failed";

export interface ReengagementActivity {
  readonly accountId: string;
  readonly lastActivityAt: Date;
  readonly timeZone: string;
  readonly lastReengagementAttemptAt: Date | null;
}

export interface ReengagementWorkItem {
  readonly id: string;
  readonly accountId: string;
  readonly campaignId: string;
  readonly contentKey: string;
  readonly dedupeKey: string;
  readonly activityAt: Date;
  readonly status: ReengagementStatus;
  readonly activity: ReengagementActivity;
}

export interface ReengagementRepository {
  recordActivity(accountId: string, timeZone: string, at: Date): Promise<void>;
  createDueDeliveries(input: { readonly now: Date; readonly inactiveBefore: Date; readonly cooldownBefore: Date; readonly campaignId: string; readonly contentKey: string; readonly limit: number }): Promise<number>;
  listPending(input: { readonly now: Date; readonly inactiveBefore: Date; readonly limit: number }): Promise<readonly ReengagementWorkItem[]>;
  leaseForQueue(id: string, now: Date, leaseUntil: Date, token: string): Promise<boolean>;
  releaseQueueLease(id: string, token: string): Promise<void>;
  findWorkItem(id: string): Promise<ReengagementWorkItem | null>;
  skipPending(id: string, reason: string): Promise<void>;
  claimDispatch(input: { readonly id: string; readonly now: Date; readonly inactiveBefore: Date; readonly cooldownBefore: Date }): Promise<"claimed" | "already_claimed" | "recent_activity" | "frequency_cap">;
  finish(id: string, status: Exclude<ReengagementStatus, "pending" | "dispatching">, reason?: string): Promise<void>;
}

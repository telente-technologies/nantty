import type { Pool, PoolClient } from "pg";

export const defaultSandboxMessageQuota = 1_000;

export interface SandboxUsageSummary {
  readonly billingPeriod: string;
  readonly resetAt: string;
  readonly messagesSent: number;
  readonly quotaLimitMessages: number;
  readonly remainingMessages: number;
  readonly scenariosRun: number;
  readonly requestsCount: number;
}

export class SandboxQuotaExceeded extends Error {
  public readonly limit: number;
  public readonly resetAt: string;

  constructor(limit: number, resetAt: string) {
    super("Sandbox message quota for this billing period is exhausted");
    this.limit = limit;
    this.resetAt = resetAt;
  }
}

export function currentBillingPeriod(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function nextBillingResetAt(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)).toISOString();
}

export async function consumeMessageQuota(client: PoolClient, applicationId: string, now: Date = new Date()): Promise<void> {
  const period = currentBillingPeriod(now);
  const resetAt = nextBillingResetAt(now);
  await client.query(
    "INSERT INTO sandbox_usage_periods (application_id, billing_period, messages_sent, requests_count, scenarios_run, quota_limit_messages, updated_at) VALUES ($1,$2,0,0,0,$3,now()) ON CONFLICT (application_id, billing_period) DO NOTHING",
    [applicationId, period, defaultSandboxMessageQuota],
  );
  const updated = await client.query<{ readonly messages_sent: number; readonly quota_limit_messages: number }>(
    "UPDATE sandbox_usage_periods SET messages_sent = messages_sent + 1, updated_at = now() WHERE application_id = $1 AND billing_period = $2 AND messages_sent < quota_limit_messages RETURNING messages_sent, quota_limit_messages",
    [applicationId, period],
  );
  if (!updated.rows[0]) {
    const current = await client.query<{ readonly quota_limit_messages: number }>(
      "SELECT quota_limit_messages FROM sandbox_usage_periods WHERE application_id = $1 AND billing_period = $2",
      [applicationId, period],
    );
    throw new SandboxQuotaExceeded(current.rows[0]?.quota_limit_messages ?? defaultSandboxMessageQuota, resetAt);
  }
}

export async function incrementRequestUsage(database: Pool, applicationId: string, now: Date = new Date()): Promise<void> {
  const period = currentBillingPeriod(now);
  await database.query(
    "INSERT INTO sandbox_usage_periods (application_id, billing_period, messages_sent, requests_count, scenarios_run, quota_limit_messages, updated_at) VALUES ($1,$2,0,1,0,$3,now()) ON CONFLICT (application_id, billing_period) DO UPDATE SET requests_count = sandbox_usage_periods.requests_count + 1, updated_at = now()",
    [applicationId, period, defaultSandboxMessageQuota],
  );
}

export async function incrementScenarioUsage(client: PoolClient, applicationId: string, now: Date = new Date()): Promise<void> {
  const period = currentBillingPeriod(now);
  await client.query(
    "INSERT INTO sandbox_usage_periods (application_id, billing_period, messages_sent, requests_count, scenarios_run, quota_limit_messages, updated_at) VALUES ($1,$2,0,0,1,$3,now()) ON CONFLICT (application_id, billing_period) DO UPDATE SET scenarios_run = sandbox_usage_periods.scenarios_run + 1, updated_at = now()",
    [applicationId, period, defaultSandboxMessageQuota],
  );
}

export async function readApplicationUsage(database: Pool, applicationId: string | null, now: Date = new Date()): Promise<SandboxUsageSummary> {
  const period = currentBillingPeriod(now);
  const resetAt = nextBillingResetAt(now);
  if (!applicationId) {
    return { billingPeriod: period, resetAt, messagesSent: 0, quotaLimitMessages: defaultSandboxMessageQuota, remainingMessages: defaultSandboxMessageQuota, scenariosRun: 0, requestsCount: 0 };
  }
  const result = await database.query<{
    readonly messages_sent: number;
    readonly requests_count: number;
    readonly scenarios_run: number;
    readonly quota_limit_messages: number;
  }>(
    "SELECT messages_sent, requests_count, scenarios_run, quota_limit_messages FROM sandbox_usage_periods WHERE application_id = $1 AND billing_period = $2",
    [applicationId, period],
  );
  const row = result.rows[0];
  if (!row) {
    return { billingPeriod: period, resetAt, messagesSent: 0, quotaLimitMessages: defaultSandboxMessageQuota, remainingMessages: defaultSandboxMessageQuota, scenariosRun: 0, requestsCount: 0 };
  }
  return {
    billingPeriod: period,
    resetAt,
    messagesSent: row.messages_sent,
    quotaLimitMessages: row.quota_limit_messages,
    remainingMessages: Math.max(0, row.quota_limit_messages - row.messages_sent),
    scenariosRun: row.scenarios_run,
    requestsCount: row.requests_count,
  };
}

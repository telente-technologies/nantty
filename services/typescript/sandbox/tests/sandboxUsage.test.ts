import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";

import { consumeMessageQuota } from "../src/sandboxUsage.js";

describe("organization-wide Sandbox usage", () => {
  it("charges different applications in one organization against the same quota row", async () => {
    const applications = new Map([["application-a", "organization-shared"], ["application-b", "organization-shared"]]);
    const updates: string[] = [];
    let messagesSent = 0;
    const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
      if (sql.includes("SELECT organization_id FROM sandbox_applications")) {
        return { rows: [{ organization_id: applications.get(String(values?.[0])) }], rowCount: 1 };
      }
      if (sql.includes("UPDATE sandbox_organization_usage_periods SET messages_sent")) {
        updates.push(String(values?.[0]));
        messagesSent += 1;
        return { rows: [{ messages_sent: messagesSent, quota_limit_messages: 1000 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    await consumeMessageQuota({ query } as unknown as PoolClient, "application-a", new Date("2026-11-19T12:00:00Z"));
    await consumeMessageQuota({ query } as unknown as PoolClient, "application-b", new Date("2026-11-19T12:00:00Z"));

    expect(updates).toEqual(["organization-shared", "organization-shared"]);
    expect(query.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO sandbox_organization_usage_periods"))).toHaveLength(2);
    expect(query.mock.calls.every(([sql]) => !String(sql).includes("WHERE application_id = $1 AND billing_period"))).toBe(true);
  });

  it("fails closed when the application cannot be mapped to its organization", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    await expect(consumeMessageQuota({ query } as unknown as PoolClient, "missing-app")).rejects.toThrow("unavailable for quota enforcement");
    expect(query).toHaveBeenCalledTimes(1);
  });
});

import { expect } from "vitest";

import { psql } from "./commerceFixtures.util.js";
import { isErrorShape } from "./smokeReport.util.js";
import type { ApiResponse } from "./apiClient.util.js";
import { describeResponse } from "./apiClient.util.js";

export function expectClearError(response: ApiResponse, status: number | readonly number[], code?: string | readonly string[]): void {
  const statuses = typeof status === "number" ? [status] : status;
  expect(statuses, describeResponse(response)).toContain(response.status);
  expect(isErrorShape(response.body), `error body must be {message, code}: ${describeResponse(response)}`).toBe(true);
  const message: string = response.body.message;
  expect(message.length, "error message must say something").toBeGreaterThan(8);
  expect(message, "error message must not leak internals").not.toMatch(/sql|panic|stack|undefined|null pointer|prisma|ent:|pq:|goroutine/i);
  if (code !== undefined) expect(typeof code === "string" ? [code] : code, describeResponse(response)).toContain(response.body.code ?? response.body.error?.code);
}

export function unbalancedJournalEntriesSince(minutes: number): string[][] {
  return psql(`select e.id, e.kind, sum(case when l.direction = 'debit' then l.amount_minor else 0 end) - sum(case when l.direction = 'credit' then l.amount_minor else 0 end) from ledger.journal_entries e join ledger.journal_lines l on l.entry_id = e.id where e.created_at > now() - interval '${minutes} minutes' group by e.id, e.kind having sum(case when l.direction = 'debit' then l.amount_minor else 0 end) <> sum(case when l.direction = 'credit' then l.amount_minor else 0 end)`);
}

export function expectLedgerBalancedSince(minutes: number): void {
  expect(unbalancedJournalEntriesSince(minutes), "every journal entry must balance").toEqual([]);
}

export function journalKindsForReference(fragment: string): string[] {
  return psql(`select kind from ledger.journal_entries where reference like '%${fragment.replace(/'/g, "")}%' order by created_at`).map((row) => row[0] ?? "");
}

export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { decryptWebhookSecret } from "./webhookControlSupport.js";
import { postSignedWebhook, resolvePublicWebhookTarget, safeWebhookErrorCode, type ResolvedWebhookTarget } from "./webhookSecurity.js";

export async function enqueueWebhookDeliveries(client: PoolClient, applicationId: string, eventId: string, eventType: string): Promise<number> {
  const endpoints = await client.query<{ readonly id: string }>(
    "SELECT id FROM sandbox_webhook_endpoints WHERE application_id=$1 AND active=true AND deleted_at IS NULL AND $2=ANY(events) ORDER BY id",
    [applicationId, eventType],
  );
  for (const endpoint of endpoints.rows) {
    await client.query(
      "INSERT INTO sandbox_webhook_deliveries (id, endpoint_id, event_id, status, attempts, available_at, created_at, updated_at) VALUES ($1,$2,$3,'pending',0,now(),now(),now()) ON CONFLICT (endpoint_id,event_id) DO NOTHING",
      [randomUUID(), endpoint.id, eventId],
    );
  }
  return endpoints.rowCount ?? 0;
}

export interface WebhookDeliveryWorkerOptions {
  readonly secretEncryptionKey: Buffer | null;
  readonly pollMilliseconds?: number;
  readonly batchSize?: number;
  readonly onError?: (errorCode: string) => void;
  readonly resolveTarget?: (url: string) => Promise<ResolvedWebhookTarget>;
  readonly send?: typeof postSignedWebhook;
}

export function startWebhookDeliveryWorker(database: Pool, options: WebhookDeliveryWorkerOptions): () => Promise<void> {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> | undefined;
  const pollMilliseconds = Math.min(Math.max(options.pollMilliseconds ?? 2_000, 500), 30_000);

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(() => {
      running = processDueWebhookDeliveries(database, options)
        .then(() => undefined)
        .catch(() => {
          try { options.onError?.("WEBHOOK_WORKER_FAILED"); } catch { return; }
        })
        .finally(() => {
          running = undefined;
          schedule();
        });
    }, pollMilliseconds);
    timer.unref();
  };

  schedule();
  return async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    await running;
  };
}

export async function processDueWebhookDeliveries(database: Pool, options: WebhookDeliveryWorkerOptions): Promise<number> {
  const encryptionKey = options.secretEncryptionKey;
  if (!encryptionKey || encryptionKey.length !== 32) return 0;
  const jobs = await claimDueDeliveries(database, Math.min(Math.max(options.batchSize ?? 10, 1), 50));
  if (jobs.length === 0) return 0;
  const results = await Promise.allSettled(jobs.map(async (job) => {
    const startedAt = Date.now();
    const attemptId = randomUUID();
    await database.query(
      "INSERT INTO sandbox_webhook_delivery_attempts (id, delivery_id, attempt_number, outcome, started_at) VALUES ($1,$2,$3,'started',now()) ON CONFLICT (delivery_id,attempt_number) DO NOTHING",
      [attemptId, job.id, job.attempt_number],
    );
    let httpStatus: number | undefined;
    let errorCode: string | undefined;
    try {
      const secret = decryptWebhookSecret(encryptionKey, {
        nonce: job.secret_nonce,
        ciphertext: job.secret_ciphertext,
        tag: job.secret_tag,
      });
      const target = await (options.resolveTarget ?? resolvePublicWebhookTarget)(job.url);
      const result = await (options.send ?? postSignedWebhook)({
        target,
        secret,
        eventId: job.event_id,
        event: job.event_type,
        createdAt: job.event_created_at.toISOString(),
        data: job.event_data,
      });
      httpStatus = result.statusCode;
    } catch (cause) {
      errorCode = safeWebhookErrorCode(cause);
    }
    await finishAttempt(database, job, attemptId, {
      outcome: errorCode ? "failed" : "succeeded",
      httpStatus,
      errorCode,
      durationMilliseconds: Date.now() - startedAt,
    });
  }));
  if (results.some((result) => result.status === "rejected")) throw new Error("Webhook delivery batch persistence failed");
  return jobs.length;
}

interface DeliveryJob {
  readonly id: string;
  readonly endpoint_id: string;
  readonly event_id: string;
  readonly attempts: number;
  readonly attempt_number: number;
  readonly url: string;
  readonly secret_nonce: Buffer;
  readonly secret_ciphertext: Buffer;
  readonly secret_tag: Buffer;
  readonly event_type: string;
  readonly event_data: unknown;
  readonly event_created_at: Date;
}

async function claimDueDeliveries(database: Pool, batchSize: number): Promise<DeliveryJob[]> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query<DeliveryJob>(
      "SELECT d.id, d.endpoint_id, d.event_id, d.attempts + 1 AS attempts, (SELECT COALESCE(MAX(a.attempt_number),0)+1 FROM sandbox_webhook_delivery_attempts a WHERE a.delivery_id=d.id) AS attempt_number, e.url, e.secret_nonce, e.secret_ciphertext, e.secret_tag, v.event_type, v.data AS event_data, v.created_at AS event_created_at FROM sandbox_webhook_deliveries d JOIN sandbox_webhook_endpoints e ON e.id=d.endpoint_id JOIN sandbox_events v ON v.id=d.event_id WHERE e.active=true AND e.deleted_at IS NULL AND ((d.status='pending' AND d.available_at<=now()) OR (d.status='in_flight' AND d.locked_until<=now())) ORDER BY d.available_at,d.created_at LIMIT $1 FOR UPDATE OF d SKIP LOCKED",
      [batchSize],
    );
    const ids = selected.rows.map((job) => job.id);
    if (ids.length > 0) {
      await client.query(
        "UPDATE sandbox_webhook_deliveries SET status='in_flight', attempts=attempts+1, locked_until=now()+interval '30 seconds', updated_at=now() WHERE id=ANY($1::uuid[])",
        [ids],
      );
    }
    await client.query("COMMIT");
    return selected.rows;
  } catch (cause) {
    try { await client.query("ROLLBACK"); } catch { return Promise.reject(cause); }
    throw cause;
  } finally {
    client.release();
  }
}

async function finishAttempt(database: Pool, job: DeliveryJob, attemptId: string, result: { readonly outcome: "succeeded" | "failed"; readonly httpStatus?: number; readonly errorCode?: string; readonly durationMilliseconds: number }): Promise<void> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE sandbox_webhook_delivery_attempts SET outcome=$2,http_status=$3,error_code=$4,duration_ms=$5,finished_at=now() WHERE id=$1",
      [attemptId, result.outcome, result.httpStatus ?? null, result.errorCode ?? null, result.durationMilliseconds],
    );
    if (result.outcome === "succeeded") {
      await client.query("UPDATE sandbox_webhook_deliveries SET status='succeeded',last_http_status=$2,last_error_code=NULL,locked_until=NULL,delivered_at=now(),updated_at=now() WHERE id=$1", [job.id, result.httpStatus]);
    } else if (job.attempts >= 8) {
      await client.query("UPDATE sandbox_webhook_deliveries SET status='failed',last_http_status=NULL,last_error_code=$2,locked_until=NULL,updated_at=now() WHERE id=$1", [job.id, result.errorCode]);
    } else {
      const delaySeconds = Math.min(5 * (2 ** Math.max(0, job.attempts - 1)), 3600);
      await client.query("UPDATE sandbox_webhook_deliveries SET status='pending',available_at=now()+($2 * interval '1 second'),last_http_status=NULL,last_error_code=$3,locked_until=NULL,updated_at=now() WHERE id=$1", [job.id, delaySeconds, result.errorCode]);
    }
    await client.query("COMMIT");
  } catch (cause) {
    try { await client.query("ROLLBACK"); } catch { return Promise.reject(cause); }
    throw cause;
  } finally {
    client.release();
  }
}

import type { Logger } from "@nantty/fastify-platform";

import type { PushProvider, PushSender, PushSendResult, PushTokenFailure } from "../interfaces/pushSender.interface.js";
import type { PushContent } from "../types/notification.type.js";
import { normalizePushProviderCode } from "../utils/pushFailure.util.js";

export class LoggingPushSender implements PushSender {
  public constructor(private readonly logger: Logger) {}

  public async send(tokens: readonly string[], content: PushContent): Promise<PushSendResult> {
    this.logger.info("push notification (log adapter)", { recipients: tokens.length, title: content.title });
    return { acceptedCount: 0, failures: [], simulated: true };
  }

  public async sendSilent(tokens: readonly string[], data: Readonly<Record<string, unknown>>): Promise<PushSendResult> {
    this.logger.info("silent push (log adapter)", { recipients: tokens.length, type: String(data["type"] ?? "") });
    return { acceptedCount: 0, failures: [], simulated: true };
  }
}

interface ExpoTicket {
  readonly status?: unknown;
  readonly details?: unknown;
}

const permanentExpoErrors = new Set(["DeviceNotRegistered", "MessageTooBig", "InvalidCredentials", "MismatchSenderId"]);

export class ExpoPushSender implements PushSender {
  public async send(tokens: readonly string[], content: PushContent, provider: PushProvider = "expo"): Promise<PushSendResult> {
    if (provider !== "expo") return disabledProviderResult(tokens);
    return postExpoMessages(tokens.map((to) => ({
      to,
      title: content.title,
      body: content.body,
      data: content.data ?? {},
      sound: content.sound === undefined ? "default" : content.sound,
      ...(content.categoryId === undefined ? {} : { categoryId: content.categoryId }),
      ...(content.threadId === undefined ? {} : { threadId: content.threadId }),
      ...(content.channelId === undefined ? {} : { channelId: content.channelId }),
    })));
  }

  public async sendSilent(tokens: readonly string[], data: Readonly<Record<string, unknown>>, provider: PushProvider = "expo"): Promise<PushSendResult> {
    if (provider !== "expo") return disabledProviderResult(tokens);
    return postExpoMessages(tokens.map((to) => ({ to, data, _contentAvailable: true, priority: "normal" })));
  }
}

export function disabledProviderResult(tokens: readonly string[]): PushSendResult {
  return { acceptedCount: 0, failures: tokens.map((token) => ({ token, classification: "permanent", code: "PROVIDER_DISABLED" })) };
}

async function postExpoMessages(messages: readonly Record<string, unknown>[]): Promise<PushSendResult> {
  let acceptedCount = 0;
  const failures: PushTokenFailure[] = [];

  for (let offset = 0; offset < messages.length; offset += 100) {
    const batch = messages.slice(offset, offset + 100);
    const tokens = batch.map((message) => String(message["to"]));
    let response: Response;
    try {
      response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      failures.push(...tokens.map((token) => ({ token, classification: "retryable" as const, code: "NETWORK_ERROR" })));
      continue;
    }

    if (!response.ok) {
      const code = await readRequestErrorCode(response);
      const classification: PushTokenFailure["classification"] = response.status === 429 || response.status >= 500 ? "retryable" : "permanent";
      failures.push(...tokens.map((token) => ({ token, classification, code })));
      continue;
    }

    const tickets = await readTickets(response);
    if (tickets === null || tickets.length !== tokens.length) {
      failures.push(...tokens.map((token) => ({ token, classification: "retryable" as const, code: "INVALID_TICKET_RESPONSE" })));
      continue;
    }

    tickets.forEach((value, index) => {
      const ticket = isRecord(value) ? value as ExpoTicket : {};
      if (ticket.status === "ok") {
        acceptedCount += 1;
        return;
      }
      if (ticket.status !== "error") {
        failures.push({ token: tokens[index]!, classification: "retryable", code: "INVALID_TICKET" });
        return;
      }
      failures.push(classifyTicketFailure(tokens[index]!, ticket));
    });
  }

  return { acceptedCount, failures };
}

async function readTickets(response: Response): Promise<readonly unknown[] | null> {
  try {
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body["data"])) return null;
    return body["data"];
  } catch {
    return null;
  }
}

async function readRequestErrorCode(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && Array.isArray(body["errors"])) {
      const first = body["errors"].find(isRecord);
      if (first !== undefined && typeof first["code"] === "string") return normalizePushProviderCode(first["code"]);
    }
  } catch {
    // Status remains useful when Expo sends a non-JSON gateway response.
  }
  return normalizePushProviderCode(`HTTP_${response.status}`);
}

function classifyTicketFailure(token: string, ticket: ExpoTicket): PushTokenFailure {
  const details = isRecord(ticket.details) ? ticket.details : {};
  const rawCode = typeof details["error"] === "string" ? details["error"] : "UNKNOWN_TICKET_ERROR";
  return {
    token,
    // Only provider errors documented as non-recoverable are terminal; unknown errors stay retryable.
    classification: permanentExpoErrors.has(rawCode) ? "permanent" : "retryable",
    code: normalizePushProviderCode(rawCode),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

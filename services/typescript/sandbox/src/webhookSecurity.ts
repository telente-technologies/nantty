import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createHmac } from "node:crypto";
import { request as httpsRequest } from "node:https";

export interface ResolvedWebhookTarget {
  readonly url: URL;
  readonly hostname: string;
  readonly address: string;
  readonly family: 4 | 6;
}

export type WebhookResolver = (hostname: string) => Promise<readonly { readonly address: string; readonly family: number }[]>;

const blockedHostSuffixes = [".localhost", ".local", ".internal", ".test", ".invalid", ".example"];
const maximumWebhookBodyBytes = 32 * 1024;
const maximumWebhookResponseBytes = 16 * 1024;

export async function resolvePublicWebhookTarget(value: string, resolver: WebhookResolver = resolveHost): Promise<ResolvedWebhookTarget> {
  const url = parseWebhookUrl(value);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || blockedHostSuffixes.some((suffix) => hostname.endsWith(suffix)) || isIP(hostname) !== 0) {
    throw new WebhookTargetError("WEBHOOK_HOST_NOT_PUBLIC");
  }
  const records = await resolver(hostname);
  if (records.length === 0 || records.some((record) => !isPublicAddress(record.address, record.family))) {
    throw new WebhookTargetError("WEBHOOK_HOST_NOT_PUBLIC");
  }
  const selected = records[0]!;
  return { url, hostname, address: selected.address, family: selected.family as 4 | 6 };
}

export function parseWebhookUrl(value: string): URL {
  if (value.length > 2048) throw new WebhookTargetError("WEBHOOK_URL_INVALID");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WebhookTargetError("WEBHOOK_URL_INVALID");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")) {
    throw new WebhookTargetError("WEBHOOK_URL_INVALID");
  }
  return url;
}

export function isPublicAddress(address: string, family = isIP(address)): boolean {
  if (family === 4) {
    const octets = address.split(".").map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
    const [a, b, c] = octets as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b! >= 64 && b! <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b! >= 16 && b! <= 31) return false;
    if (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99) || (b === 0 && c === 2))) return false;
    if (a === 198 && ((b === 18 || b === 19) || (b === 51 && c === 100))) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  if (family !== 6 || isIP(address) !== 6) return false;
  const value = parseIPv6(address);
  if (value === null) return false;
  if (!hasPrefix(value, "2000::", 3)) return false;
  if (hasPrefix(value, "2001:db8::", 32) || hasPrefix(value, "2001:10::", 28) || hasPrefix(value, "2001:20::", 28) || hasPrefix(value, "2001:2::", 48) || hasPrefix(value, "2002::", 16)) return false;
  return true;
}

export async function postSignedWebhook(input: {
  readonly target: ResolvedWebhookTarget;
  readonly secret: string;
  readonly eventId: string;
  readonly event: string;
  readonly createdAt: string;
  readonly data: unknown;
  readonly timeoutMilliseconds?: number;
}): Promise<{ readonly statusCode: number; readonly durationMilliseconds: number }> {
  const signed = createSignedWebhookEnvelope({ secret: input.secret, eventId: input.eventId, event: input.event, createdAt: input.createdAt, data: input.data });
  const body = signed.body;
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    let responseBytes = 0;
    const timeoutMilliseconds = Math.min(Math.max(input.timeoutMilliseconds ?? 5_000, 500), 30_000);
    const request = httpsRequest({
      protocol: "https:",
      hostname: input.target.hostname,
      port: input.target.url.port ? Number(input.target.url.port) : 443,
      method: "POST",
      path: `${input.target.url.pathname}${input.target.url.search}`,
      agent: false,
      timeout: timeoutMilliseconds,
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        "user-agent": "Nantty-Sandbox-Webhooks/1.0",
        "nantty-signature": signed.signature,
        "nantty-event-id": input.eventId,
      },
      lookup: (_hostname, _options, callback) => callback(null, input.target.address, input.target.family),
    }, (response) => {
      response.on("data", (chunk: Buffer | string) => {
        responseBytes += Buffer.byteLength(chunk);
        if (responseBytes > maximumWebhookResponseBytes) request.destroy(new WebhookDeliveryError("RESPONSE_TOO_LARGE"));
      });
      response.on("end", () => {
        clearTimeout(deadline);
        const statusCode = response.statusCode ?? 0;
        if (statusCode < 200 || statusCode >= 300) return reject(new WebhookDeliveryError("ENDPOINT_REJECTED"));
        resolve({ statusCode, durationMilliseconds: Date.now() - startedAt });
      });
    });
    const deadline = setTimeout(() => request.destroy(new WebhookDeliveryError("ENDPOINT_TIMEOUT")), timeoutMilliseconds);
    request.on("timeout", () => request.destroy(new WebhookDeliveryError("ENDPOINT_TIMEOUT")));
    request.on("close", () => clearTimeout(deadline));
    request.on("error", (cause: Error) => {
      clearTimeout(deadline);
      reject(cause instanceof WebhookDeliveryError ? cause : new WebhookDeliveryError("ENDPOINT_UNREACHABLE"));
    });
    request.end(body);
  });
}

export function createSignedWebhookEnvelope(input: {
  readonly secret: string;
  readonly eventId: string;
  readonly event: string;
  readonly createdAt: string;
  readonly data: unknown;
  readonly timestampSeconds?: number;
}): { readonly body: string; readonly timestamp: string; readonly signature: string } {
  const body = JSON.stringify({ id: input.eventId, event: input.event, createdAt: input.createdAt, data: input.data });
  if (Buffer.byteLength(body) > maximumWebhookBodyBytes) throw new WebhookDeliveryError("PAYLOAD_TOO_LARGE");
  const timestamp = String(input.timestampSeconds ?? Math.floor(Date.now() / 1000));
  const digest = createHmac("sha256", input.secret).update(`${timestamp}.${body}`).digest("hex");
  return { body, timestamp, signature: `t=${timestamp},v1=${digest}` };
}

export function safeWebhookErrorCode(cause: unknown): string {
  return cause instanceof WebhookTargetError || cause instanceof WebhookDeliveryError ? cause.code : "ENDPOINT_UNREACHABLE";
}

export class WebhookTargetError extends Error {
  constructor(readonly code: "WEBHOOK_URL_INVALID" | "WEBHOOK_HOST_NOT_PUBLIC") { super(code); }
}

export class WebhookDeliveryError extends Error {
  constructor(readonly code: "PAYLOAD_TOO_LARGE" | "RESPONSE_TOO_LARGE" | "ENDPOINT_TIMEOUT" | "ENDPOINT_REJECTED" | "ENDPOINT_UNREACHABLE") { super(code); }
}

async function resolveHost(hostname: string): Promise<readonly { readonly address: string; readonly family: number }[]> {
  return dnsLookup(hostname, { all: true, verbatim: true });
}

function parseIPv6(address: string): bigint | null {
  const lowered = address.toLowerCase();
  const halves = lowered.split("::");
  if (halves.length > 2) return null;
  const parseHalf = (half: string): number[] => half ? half.split(":").map((part) => Number.parseInt(part, 16)) : [];
  const left = parseHalf(halves[0]!);
  const right = parseHalf(halves[1] ?? "");
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const words = [...left, ...Array.from({ length: missing }, () => 0), ...right];
  if (words.length !== 8 || words.some((word) => !Number.isInteger(word) || word < 0 || word > 0xffff)) return null;
  return words.reduce((value, word) => (value << 16n) | BigInt(word), 0n);
}

function hasPrefix(address: bigint, prefixAddress: string, prefixLength: number): boolean {
  const prefix = parseIPv6(prefixAddress);
  if (prefix === null) return false;
  const shift = BigInt(128 - prefixLength);
  return (address >> shift) === (prefix >> shift);
}

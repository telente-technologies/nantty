import { importPKCS8, SignJWT } from "jose";

import type { PushProvider, PushSender, PushSendResult, PushTokenFailure } from "../interfaces/pushSender.interface.js";
import type { PushContent } from "../types/notification.type.js";
import { disabledProviderResult } from "./expoPush.integration.js";

const tokenEndpoint = "https://oauth2.googleapis.com/token";
const messagingScope = "https://www.googleapis.com/auth/firebase.messaging";
const tokenLifetimeMarginMs = 60_000;
const batchSize = 20;

interface FcmConfiguration {
  readonly projectId: string;
  readonly clientEmail: string;
  readonly privateKey: string;
}

interface OAuthResponse {
  readonly access_token?: unknown;
  readonly expires_in?: unknown;
}

interface FcmErrorResponse {
  readonly error?: {
    readonly status?: unknown;
    readonly details?: readonly unknown[];
  };
}

export class FcmPushSender implements PushSender {
  private cachedAccessToken: { readonly value: string; readonly expiresAt: number } | null = null;
  private accessTokenRequest: Promise<string> | null = null;

  public constructor(
    private readonly config: FcmConfiguration,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  public async send(tokens: readonly string[], content: PushContent, provider: PushProvider = "fcm"): Promise<PushSendResult> {
    if (provider !== "fcm") return disabledProviderResult(tokens);
    const isBubbleEligibleChat = content.data?.["bubbleAllowed"] === "true";
    const data = {
      ...(content.data ?? {}),
      ...(content.categoryId ? { categoryId: content.categoryId } : {}),
      ...(content.threadId ? { threadIdentifier: content.threadId } : {}),
      ...(content.channelId ? { channelId: content.channelId } : {}),
      ...(content.sound === null ? { sound: "" } : {}),
      ...(isBubbleEligibleChat ? { title: content.title, message: content.body } : {}),
    };

    return this.sendMessages(tokens, (token) => isBubbleEligibleChat
      ? {
          token,
          // A notification payload is rendered directly by Android in the background,
          // bypassing Expo's receiver where Nantty attaches BubbleMetadata.
          data: toFcmData(data),
          android: { priority: "HIGH" },
        }
      : {
          token,
          notification: { title: content.title, body: content.body },
          data: toFcmData(data),
          android: { priority: "HIGH", ...(content.channelId ? { notification: { channel_id: content.channelId } } : {}) },
          apns: { headers: { "apns-priority": "10" }, payload: { aps: { ...(content.sound === null ? {} : { sound: "default" }), ...(content.threadId ? { "thread-id": content.threadId } : {}), ...(content.categoryId ? { category: content.categoryId } : {}) } } },
        });
  }

  public async sendSilent(tokens: readonly string[], data: Readonly<Record<string, unknown>>, provider: PushProvider = "fcm"): Promise<PushSendResult> {
    if (provider !== "fcm") return disabledProviderResult(tokens);
    return this.sendMessages(tokens, (token) => ({
      token,
      data: toFcmData(data),
      android: { priority: "NORMAL" },
      apns: { headers: { "apns-priority": "5" }, payload: { aps: { "content-available": 1 } } },
    }));
  }

  private async sendMessages(tokens: readonly string[], createMessage: (token: string) => Record<string, unknown>): Promise<PushSendResult> {
    const failures: PushTokenFailure[] = [];
    let acceptedCount = 0;
    for (let offset = 0; offset < tokens.length; offset += batchSize) {
      const outcomes = await Promise.all(tokens.slice(offset, offset + batchSize).map(async (token) => this.sendOne(token, createMessage(token))));
      for (const outcome of outcomes) {
        if (outcome === null) acceptedCount += 1;
        else failures.push(outcome);
      }
    }
    return { acceptedCount, failures };
  }

  private async sendOne(token: string, message: Record<string, unknown>): Promise<PushTokenFailure | null> {
    let accessToken: string;
    try {
      accessToken = await this.getAccessToken();
    } catch {
      return { token, classification: "retryable", code: "FCM_AUTH_UNAVAILABLE" };
    }

    let response: Response;
    try {
      response = await this.fetcher(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.config.projectId)}/messages:send`, {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return { token, classification: "retryable", code: "NETWORK_ERROR" };
    }

    if (response.ok) return null;
    const code = await readFcmErrorCode(response);
    const classification = classifyFcmFailure(response.status, code);
    return { token, classification, code };
  }

  private async getAccessToken(): Promise<string> {
    const now = this.now();
    if (this.cachedAccessToken !== null && this.cachedAccessToken.expiresAt - tokenLifetimeMarginMs > now) return this.cachedAccessToken.value;
    if (this.accessTokenRequest !== null) return this.accessTokenRequest;

    this.accessTokenRequest = this.requestAccessToken();
    try {
      return await this.accessTokenRequest;
    } finally {
      this.accessTokenRequest = null;
    }
  }

  private async requestAccessToken(): Promise<string> {
    const nowSeconds = Math.floor(this.now() / 1000);
    const privateKey = await importPKCS8(this.config.privateKey, "RS256");
    const assertion = await new SignJWT({ scope: messagingScope })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(this.config.clientEmail)
      .setSubject(this.config.clientEmail)
      .setAudience(tokenEndpoint)
      .setIssuedAt(nowSeconds)
      .setExpirationTime(nowSeconds + 3600)
      .sign(privateKey);

    const response = await this.fetcher(tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("FCM OAuth token request failed");
    const body: unknown = await response.json();
    if (!isRecord(body)) throw new Error("FCM OAuth token response was invalid");
    const parsed = body as OAuthResponse;
    if (typeof parsed.access_token !== "string" || typeof parsed.expires_in !== "number") throw new Error("FCM OAuth token response was invalid");
    this.cachedAccessToken = { value: parsed.access_token, expiresAt: this.now() + parsed.expires_in * 1000 };
    return parsed.access_token;
  }
}

function toFcmData(data: Readonly<Record<string, unknown>>): Record<string, string> {
  return Object.fromEntries(Object.entries(data).flatMap(([key, value]) => {
    if (typeof value === "string") return [[key, value]];
    const encoded = JSON.stringify(value);
    return encoded === undefined ? [] : [[key, encoded]];
  }));
}

async function readFcmErrorCode(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (!isRecord(body) || !isRecord(body["error"])) return `HTTP_${response.status}`;
    const error = body["error"] as FcmErrorResponse["error"];
    if (error?.status === "UNREGISTERED") return "UNREGISTERED";
    if (error?.status === "RESOURCE_EXHAUSTED") return "RESOURCE_EXHAUSTED";
    if (error?.status === "UNAVAILABLE") return "UNAVAILABLE";
    if (error?.status === "INTERNAL") return "INTERNAL";
    if (error?.status === "PERMISSION_DENIED") return "PERMISSION_DENIED";
    if (error?.status === "UNAUTHENTICATED") return "UNAUTHENTICATED";
    if (error?.status === "INVALID_ARGUMENT") return "INVALID_ARGUMENT";
  } catch {
    // Never retain raw provider response text; use only a bounded status code.
  }
  return `HTTP_${response.status}`;
}

function classifyFcmFailure(status: number, code: string): PushTokenFailure["classification"] {
  if (code === "UNREGISTERED") return "permanent";
  if (code === "INVALID_ARGUMENT" || code === "PERMISSION_DENIED" || code === "UNAUTHENTICATED") return "permanent";
  if (status === 429 || status >= 500 || code === "RESOURCE_EXHAUSTED" || code === "UNAVAILABLE" || code === "INTERNAL") return "retryable";
  return "retryable";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

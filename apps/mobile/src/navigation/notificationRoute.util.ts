import { getStateFromPath, type NavigationState, type PartialState } from "@react-navigation/native";

import { deepLinkPrefixes } from "@/config/webAppLinks.config";

import { deepLinking } from "./linking.config";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function notificationData(payload: unknown): Record<string, unknown> | null {
  const record = asRecord(payload);
  if (record === null) return null;
  const notificationData = asRecord(asRecord(asRecord(asRecord(record["notification"])?.["request"])?.["content"])?.["data"]);
  return notificationData ?? asRecord(record["data"]) ?? record;
}

function normalizeTrustedAppUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const parsed = new URL(value);
    const trustedWebOrigins = deepLinkPrefixes.flatMap((prefix) => {
      try {
        const candidate = new URL(prefix);
        return candidate.protocol === "https:" ? [candidate.origin] : [];
      } catch {
        return [];
      }
    });
    if (parsed.protocol === "https:" && trustedWebOrigins.includes(parsed.origin)) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (parsed.protocol === "nantty:" || parsed.protocol === "com.nantty.app:") return `/${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
  return null;
}

function idSegment(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "" || value.length > 200 || Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  })) return null;
  return encodeURIComponent(value);
}

function notificationPath(payload: unknown): string | null {
  const data = notificationData(payload);
  if (data === null) return null;
  const explicit = normalizeTrustedAppUrl(data["url"]);
  if (explicit !== null) return explicit;

  if (data["screen"] === "GroupInvitations") return "/chats/invitations";
  if (data["screen"] === "AccountStatus") return "/settings/account-status";
  if (data["screen"] === "Verification") return "/settings/verification";
  if (data["kind"] === "followRequest") return "/me/follow-requests";
  const conversationId = idSegment(data["conversationId"]);
  if (conversationId !== null) return `/chats/${conversationId}`;
  const clipId = idSegment(data["clipId"]);
  const postId = idSegment(data["postId"]);
  const commentId = idSegment(data["commentId"]);
  const commentPostId = postId ?? clipId;
  if (commentPostId !== null && commentId !== null) return `/post/${commentPostId}/comments/${commentId}`;
  if (clipId !== null) return `/clips/${clipId}`;
  if (postId !== null) return `/post/${postId}`;
  const liveId = idSegment(data["liveId"]);
  if (liveId !== null) return `/live/${liveId}`;
  const disputeId = idSegment(data["disputeId"]);
  if (disputeId !== null) return `/disputes/${disputeId}`;
  const ticketId = idSegment(data["ticketId"]);
  if (ticketId !== null) return `/help/tickets/${ticketId}`;
  const orderId = idSegment(data["orderId"]);
  if (orderId !== null) return `/orders/${orderId}`;
  return null;
}

function containsUnknownRoute(state: PartialState<NavigationState>): boolean {
  return state.routes.some((route) => route.name === "NotFound" || (route.state !== undefined && containsUnknownRoute(route.state as PartialState<NavigationState>)));
}

/** Resolve only server-provided same-app relative routes; push data cannot open arbitrary URLs. */
export function navigationStateFromNotification(payload: unknown): PartialState<NavigationState> | null {
  const rawPath = notificationPath(payload);
  const containsControlCharacter = rawPath !== null && Array.from(rawPath).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
  if (rawPath === null || rawPath.length > 2048 || !rawPath.startsWith("/") || rawPath.startsWith("//") || rawPath.includes("\\") || /%2f|%5c/i.test(rawPath) || containsControlCharacter) return null;

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (decodedPath.startsWith("//") || decodedPath.includes("\\")) return null;

  const state = getStateFromPath(rawPath.slice(1), deepLinking.config) as PartialState<NavigationState> | undefined;
  return state === undefined || containsUnknownRoute(state) ? null : state;
}

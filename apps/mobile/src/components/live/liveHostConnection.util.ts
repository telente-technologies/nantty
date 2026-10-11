import { ApiError } from "@/errors/api.error";
import type { LiveHostHeartbeat } from "@/services/live/live.service";

export type HeartbeatOutcome = "connected" | "reconnecting" | "ended" | "stop";

const isTemporaryFailure = (error: unknown) =>
  !(error instanceof ApiError) || error.status === 408 || error.status === 429 || error.status >= 500;

export function classifyHeartbeatOutcome(result: { readonly heartbeat: LiveHostHeartbeat } | { readonly error: unknown }): HeartbeatOutcome {
  if ("heartbeat" in result) return result.heartbeat.status === "ended" ? "ended" : "connected";
  if (isTemporaryFailure(result.error)) return "reconnecting";
  if (result.error instanceof ApiError && result.error.code === "LIVE_NOT_FOUND") return "ended";
  return "stop";
}

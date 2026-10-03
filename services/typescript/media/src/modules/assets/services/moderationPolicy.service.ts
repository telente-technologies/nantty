import type { MediaConfig } from "../../../configs/media.config.js";
import type { ModerationClient, ModerationRequest } from "../../../interfaces/moderationClient.interface.js";

export type ModerationDecision = "allow" | "hold" | "reject";

export interface ModerationOutcome {
  readonly decision: ModerationDecision;
  readonly score: number | null;
  readonly category: string | null;
  readonly degraded: boolean;
}

export function decideModerationFromScore(score: number, thresholds: { readonly holdThreshold: number; readonly rejectThreshold: number }): ModerationDecision {
  if (score >= thresholds.rejectThreshold) return "reject";
  return score >= thresholds.holdThreshold ? "hold" : "allow";
}

export async function evaluateModeration(client: ModerationClient | undefined, config: MediaConfig["moderation"], request: ModerationRequest): Promise<ModerationOutcome> {
  if (client === undefined || request.frames.length === 0) return { decision: "allow", score: null, category: null, degraded: client === undefined };
  try {
    const result = await client.classify(request);
    return { decision: decideModerationFromScore(result.score, config), score: result.score, category: result.topCategory, degraded: false };
  } catch {
    return { decision: config.failMode === "hold" ? "hold" : "allow", score: null, category: null, degraded: true };
  }
}

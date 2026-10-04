import { sensitiveLabelOptions } from "@/constants/postAudienceCopy.constant";
import type { SensitiveContent, SensitiveLabel } from "@/types/postAudience.type";

export type SensitiveInterstitialState = "none" | "covered" | "revealed";

export function decideSensitiveInterstitialState(sensitive: SensitiveContent | null | undefined, hasViewerConsented: boolean): SensitiveInterstitialState {
  if (!sensitive || sensitive.labels.length === 0 || !sensitive.requiresInterstitial) return "none";
  return hasViewerConsented ? "revealed" : "covered";
}

export function describeSensitiveLabels(labels: readonly SensitiveLabel[]): string {
  const phrases = sensitiveLabelOptions.filter((option) => labels.includes(option.value)).map((option) => option.phrase);
  if (phrases.length === 0) return "This post may contain sensitive content.";
  const joined = phrases.length === 1 ? phrases[0] : `${phrases.slice(0, -1).join(", ")} and ${phrases.at(-1)}`;
  return `This post may contain ${joined}.`;
}

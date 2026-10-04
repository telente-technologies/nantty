import { sensitiveLabelOptions } from "../config/postAudience.config";
import type { SensitiveContent, SensitiveLabel } from "../types/postAudience.type";

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

const consentStorageKey = "zm.sensitiveConsentPostIds";
const maximumRememberedPosts = 300;

export function readSensitiveConsentPostIds(storage: Pick<Storage, "getItem"> | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(consentStorageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function rememberSensitiveConsentForPost(storage: Pick<Storage, "getItem" | "setItem"> | undefined, postId: string): string[] {
  const current = readSensitiveConsentPostIds(storage);
  const next = current.includes(postId) ? current : [postId, ...current].slice(0, maximumRememberedPosts);
  try {
    storage?.setItem(consentStorageKey, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}

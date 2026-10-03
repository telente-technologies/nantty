import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";

import type { PolicyVersionSummary } from "@/types";

export function formatPolicyEffectiveDate(isoText: string): string {
  return new Date(isoText).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function listPolicyHighlights(version: PolicyVersionSummary): readonly string[] {
  if (version.whatChanged && version.whatChanged.length > 0) return version.whatChanged;
  const lines = version.summary.split(/\n+/).map((line) => line.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
  return lines.length > 0 ? lines : [version.summary];
}

export function joinPolicyTitles(versions: readonly PolicyVersionSummary[]): string {
  const titles = versions.map((version) => version.title);
  if (titles.length <= 1) return titles[0] ?? "";
  return `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
}

export function hasPolicyTakenEffect(version: PolicyVersionSummary): boolean {
  return Date.parse(version.effectiveAt) <= Date.now();
}

export async function openPolicyDocumentInApp(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
  } catch {
    await Linking.openURL(url).catch(() => undefined);
  }
}

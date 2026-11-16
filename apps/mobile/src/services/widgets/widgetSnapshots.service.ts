import { apiConfig } from "@/config/api.config";
import { moneyWidgetKinds, widgetEndpoints, widgetKinds, widgetStorageKeys, type WidgetKind } from "@/config/widgets.config";
import { ApiError } from "@/errors/api.error";
import { api } from "@/services/core/apiClient.service";
import type { WidgetPayloads, WidgetSessionDescriptor, WidgetSnapshot } from "@/types/widget.type";

import { writeWidgetSharedValue } from "./widgetNativeBridge.service";

export function widgetEndpointFor(kind: WidgetKind, hideAmounts: boolean): string {
  const endpoint = widgetEndpoints[kind];
  return hideAmounts && moneyWidgetKinds.includes(kind) ? `${endpoint}?amounts=hidden` : endpoint;
}

export function maskWidgetAmounts<K extends WidgetKind>(kind: K, payload: WidgetPayloads[K], hideAmounts: boolean): WidgetPayloads[K] {
  if (!hideAmounts) return payload;
  if (kind === "sellerToday") return { ...(payload as WidgetPayloads["sellerToday"]), salesToday: null, availableBalance: null, amountsHidden: true } as WidgetPayloads[K];
  if (kind === "creatorToday") return { ...(payload as WidgetPayloads["creatorToday"]), earningsToday: null, amountsHidden: true } as WidgetPayloads[K];
  return payload;
}

async function fetchWidgetSnapshot<K extends WidgetKind>(kind: K, hideAmounts: boolean, savedAt: string): Promise<WidgetSnapshot<K> | null> {
  try {
    const payload = await api.get<WidgetPayloads[K]>(widgetEndpointFor(kind, hideAmounts));
    return { state: "ready", savedAt, payload: maskWidgetAmounts(kind, payload, hideAmounts) };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return { state: "unavailable", savedAt };
    return null;
  }
}

export async function writeWidgetSession(descriptor: WidgetSessionDescriptor): Promise<void> {
  await writeWidgetSharedValue(widgetStorageKeys.session, JSON.stringify(descriptor));
}

export async function refreshWidgetSnapshots(hideAmounts: boolean, kinds: readonly WidgetKind[] = widgetKinds, now = new Date()): Promise<readonly WidgetKind[]> {
  await writeWidgetSession({ signedIn: true, apiBaseUrl: apiConfig.baseUrl, hideAmounts, theme: "system" });
  const savedAt = now.toISOString();
  const results = await Promise.all(kinds.map(async (kind) => [kind, await fetchWidgetSnapshot(kind, hideAmounts, savedAt)] as const));
  const written: WidgetKind[] = [];
  for (const [kind, snapshot] of results) {
    if (snapshot === null) continue;
    await writeWidgetSharedValue(widgetStorageKeys.snapshotPrefix + kind, JSON.stringify(snapshot));
    written.push(kind);
  }
  return written;
}

export async function clearWidgetSnapshotsForSignOut(): Promise<void> {
  const signedOut: WidgetSnapshot = { state: "signedOut" };
  await writeWidgetSession({ signedIn: false, apiBaseUrl: apiConfig.baseUrl, hideAmounts: true, theme: "system" });
  for (const kind of widgetKinds) await writeWidgetSharedValue(widgetStorageKeys.snapshotPrefix + kind, JSON.stringify(signedOut));
}

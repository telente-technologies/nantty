import { widgetStorageKeys, type WidgetKind } from "@/config/widgets.config";
import { readWidgetSecret, readWidgetSharedValue, writeWidgetSharedValue } from "@/services/widgets/widgetNativeBridge.service";
import { maskWidgetAmounts, widgetEndpointFor } from "@/services/widgets/widgetSnapshots.service";
import type { WidgetPayloads, WidgetSessionDescriptor, WidgetSnapshot } from "@/types/widget.type";

const widgetFetchTimeoutMs = 10_000;

export function parseWidgetSnapshot<K extends WidgetKind>(raw: string | null): WidgetSnapshot<K> | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as WidgetSnapshot<K>;
    return parsed !== null && typeof parsed === "object" && ["signedOut", "unavailable", "ready"].includes(parsed.state) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseWidgetSession(raw: string | null): WidgetSessionDescriptor | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as WidgetSessionDescriptor;
    return typeof parsed?.signedIn === "boolean" && typeof parsed.apiBaseUrl === "string" ? parsed : null;
  } catch {
    return null;
  }
}

async function fetchFreshSnapshot<K extends WidgetKind>(kind: K, session: WidgetSessionDescriptor): Promise<WidgetSnapshot<K> | null> {
  const token = await readWidgetSecret(widgetStorageKeys.token);
  if (token === null || !session.apiBaseUrl.startsWith("https://")) return null;
  const response = await fetch(new URL(widgetEndpointFor(kind, session.hideAmounts), session.apiBaseUrl).toString(), {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    signal: AbortSignal.timeout(widgetFetchTimeoutMs),
  });
  if (response.status === 403 || response.status === 404) return { state: "unavailable", savedAt: new Date().toISOString() };
  if (!response.ok) return null;
  const payload = (await response.json()) as WidgetPayloads[K];
  return { state: "ready", savedAt: new Date().toISOString(), payload: maskWidgetAmounts(kind, payload, session.hideAmounts) };
}

export async function loadWidgetSnapshot<K extends WidgetKind>(kind: K, fetchFresh: boolean): Promise<WidgetSnapshot<K>> {
  const session = parseWidgetSession(await readWidgetSharedValue(widgetStorageKeys.session));
  if (session === null || !session.signedIn) return { state: "signedOut" };
  if (fetchFresh) {
    const fresh = await fetchFreshSnapshot(kind, session).catch(() => null);
    if (fresh !== null) {
      await writeWidgetSharedValue(widgetStorageKeys.snapshotPrefix + kind, JSON.stringify(fresh)).catch(() => undefined);
      return fresh;
    }
  }
  return parseWidgetSnapshot<K>(await readWidgetSharedValue(widgetStorageKeys.snapshotPrefix + kind)) ?? { state: "unavailable", savedAt: new Date().toISOString() };
}

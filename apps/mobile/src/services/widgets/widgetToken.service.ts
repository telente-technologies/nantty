import { widgetStorageKeys, widgetTokenRotateBeforeExpiryMs } from "@/config/widgets.config";
import { api } from "@/services/apiClient.service";

import { readWidgetSecret, readWidgetSharedValue, writeWidgetSecret, writeWidgetSharedValue } from "./widgetNativeBridge.service";

interface IssuedWidgetToken {
  readonly widgetToken: string;
  readonly expiresIn: number;
  readonly scope: string;
}

export function isWidgetTokenDueForRotation(expiresAtIso: string | null, now: number): boolean {
  if (expiresAtIso === null) return true;
  const expiresAt = Date.parse(expiresAtIso);
  return Number.isNaN(expiresAt) || expiresAt - now <= widgetTokenRotateBeforeExpiryMs;
}

export async function rotateWidgetTokenWhenDue(now: number = Date.now()): Promise<boolean> {
  const [token, expiresAt] = await Promise.all([readWidgetSecret(widgetStorageKeys.token), readWidgetSharedValue(widgetStorageKeys.tokenExpiresAt)]);
  if (token !== null && !isWidgetTokenDueForRotation(expiresAt, now)) return false;
  const issued = await api.post<IssuedWidgetToken>("/api/v1/auth/widget-token");
  if (typeof issued?.widgetToken !== "string" || issued.scope !== "widgets:read") return false;
  await writeWidgetSecret(widgetStorageKeys.token, issued.widgetToken);
  await writeWidgetSharedValue(widgetStorageKeys.tokenExpiresAt, new Date(now + issued.expiresIn * 1000).toISOString());
  return true;
}

export async function forgetWidgetTokenOnThisDevice(revokeOnServer: boolean): Promise<void> {
  if (revokeOnServer) await api.delete("/api/v1/auth/widget-token").catch(() => undefined);
  await writeWidgetSecret(widgetStorageKeys.token, null).catch(() => undefined);
  await writeWidgetSharedValue(widgetStorageKeys.tokenExpiresAt, null).catch(() => undefined);
}

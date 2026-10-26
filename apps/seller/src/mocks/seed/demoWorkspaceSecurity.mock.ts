import type { ApiKey, StoreIntegration, WebhookDelivery, WebhookEndpoint } from "@/types/developer.type";
import type { LoginHistoryEntry, SecurityOverview, SecuritySession } from "@/types/security.type";

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

export interface MockWorkspaceState {
  security: SecurityOverview;
  apiKeys: ApiKey[];
  webhooks: WebhookEndpoint[];
  webhookDeliveries: WebhookDelivery[];
  integrations: StoreIntegration[];
}

function buildDemoSessions(): SecuritySession[] {
  return [
    { id: "ses_current", device: "Chrome on Windows", app: "dashboard", location: "Lekki, Lagos", ipAddress: "102.89.•••.14", signedInAt: hoursAgo(3), lastActiveAt: hoursAgo(0), isCurrent: true },
    { id: "ses_iphone", device: "Nantty app on iPhone 13", app: "mobile_app", location: "Lekki, Lagos", ipAddress: "102.89.•••.14", signedInAt: hoursAgo(240), lastActiveAt: hoursAgo(1), isCurrent: false },
    { id: "ses_macbook", device: "Safari on macOS", app: "dashboard", location: "Wuse 2, Abuja", ipAddress: "197.210.•••.88", signedInAt: hoursAgo(96), lastActiveAt: hoursAgo(30), isCurrent: false },
    { id: "ses_tecno", device: "Nantty app on Tecno Camon 20", app: "mobile_app", location: "Ikeja, Lagos", ipAddress: "105.112.•••.201", signedInAt: hoursAgo(600), lastActiveAt: hoursAgo(72), isCurrent: false },
  ];
}

function buildDemoLoginHistory(): LoginHistoryEntry[] {
  return [
    { id: "lgn_1", outcome: "success", device: "Chrome on Windows", location: "Lekki, Lagos", ipAddress: "102.89.•••.14", occurredAt: hoursAgo(3) },
    { id: "lgn_2", outcome: "wrong_password", device: "Chrome on Windows", location: "Lekki, Lagos", ipAddress: "102.89.•••.14", occurredAt: hoursAgo(3.1) },
    { id: "lgn_3", outcome: "success", device: "Safari on macOS", location: "Wuse 2, Abuja", ipAddress: "197.210.•••.88", occurredAt: hoursAgo(96) },
    { id: "lgn_4", outcome: "blocked", device: "Firefox on Linux", location: "Unknown, Netherlands", ipAddress: "185.220.•••.5", occurredAt: hoursAgo(130) },
    { id: "lgn_5", outcome: "success", device: "Nantty app on iPhone 13", location: "Lekki, Lagos", ipAddress: "102.89.•••.14", occurredAt: hoursAgo(240) },
  ];
}

function buildDemoIntegrations(storeId: string): StoreIntegration[] {
  const isMainStore = storeId === "store_ife_lifestyle";
  return [
    { id: "quickbooks", name: "QuickBooks Online", category: "accounting", description: "Send daily sales, fees and payouts to QuickBooks as journal entries.", requiredPlanFeature: "accounting_integrations", status: isMainStore ? "connected" : "not_connected", connectedAccount: isMainStore ? "Ife Lifestyle Ltd" : null, connectedAt: isMainStore ? hoursAgo(900) : null, lastSyncedAt: isMainStore ? hoursAgo(5) : null },
    { id: "xero", name: "Xero", category: "accounting", description: "Sync invoices, refunds and settlements to Xero.", requiredPlanFeature: "accounting_integrations", status: "not_connected", connectedAccount: null, connectedAt: null, lastSyncedAt: null },
    { id: "zoho_books", name: "Zoho Books", category: "accounting", description: "Keep Zoho Books up to date with orders and payouts.", requiredPlanFeature: "accounting_integrations", status: "not_connected", connectedAccount: null, connectedAt: null, lastSyncedAt: null },
    { id: "google_sheets", name: "Google Sheets", category: "spreadsheets", description: "A live sheet of orders and stock that updates every hour.", requiredPlanFeature: null, status: isMainStore ? "needs_attention" : "not_connected", connectedAccount: isMainStore ? "adaeze@ifelifestyle.ng" : null, connectedAt: isMainStore ? hoursAgo(400) : null, lastSyncedAt: isMainStore ? hoursAgo(50) : null },
    { id: "meta_catalog", name: "Meta catalog", category: "marketing", description: "Share your products with your Instagram and Facebook shop.", requiredPlanFeature: null, status: "not_connected", connectedAccount: null, connectedAt: null, lastSyncedAt: null },
    { id: "whatsapp_business", name: "WhatsApp Business", category: "messaging", description: "Send order updates to customers on WhatsApp.", requiredPlanFeature: null, status: "not_connected", connectedAccount: null, connectedAt: null, lastSyncedAt: null },
  ];
}

export function buildDemoWorkspaceState(storeId: string): MockWorkspaceState {
  const isMainStore = storeId === "store_ife_lifestyle";
  const webhooks: WebhookEndpoint[] = isMainStore
    ? [{ id: "whk_erp", url: "https://erp.ifelifestyle.ng/hooks/zudomart", description: "Warehouse system", events: ["order.created", "order.updated", "inventory.low_stock"], active: true, signingSecretPreview: "whsec_••••a91c", createdAt: hoursAgo(2000), lastDeliveryAt: hoursAgo(1), recentFailureCount: 1 }]
    : [];
  return {
    security: { twoStepVerification: { enabled: isMainStore, method: isMainStore ? "authenticator_app" : null, enabledAt: isMainStore ? hoursAgo(3000) : null }, passwordChangedAt: hoursAgo(1400), sessions: buildDemoSessions(), loginHistory: buildDemoLoginHistory() },
    apiKeys: isMainStore
      ? [
          { id: "key_erp", name: "Warehouse system", prefix: "zk_live_4f9a", scopes: ["orders:read", "inventory:read", "inventory:write"], createdBy: "Adaeze Okafor", createdAt: hoursAgo(2000), lastUsedAt: hoursAgo(1) },
          { id: "key_sheets", name: "Monthly accounts script", prefix: "zk_live_b21c", scopes: ["orders:read", "finance:read"], createdBy: "Tunde Bakare", createdAt: hoursAgo(700), lastUsedAt: hoursAgo(200) },
        ]
      : [],
    webhooks,
    webhookDeliveries: isMainStore
      ? Array.from({ length: 12 }, (_, index) => ({
          id: `whd_${index}`,
          webhookId: "whk_erp",
          event: (["order.created", "order.updated", "inventory.low_stock"] as const)[index % 3] ?? "order.created",
          responseStatus: index === 4 ? 500 : 200,
          durationMilliseconds: index === 4 ? 3012 : 180 + index * 23,
          outcome: index === 4 ? ("failed" as const) : ("delivered" as const),
          attemptedAt: hoursAgo(1 + index * 3),
        }))
      : [],
    integrations: buildDemoIntegrations(storeId),
  };
}

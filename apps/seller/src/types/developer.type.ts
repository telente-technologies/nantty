export const apiKeyScopes = ["products:read", "products:write", "inventory:read", "inventory:write", "orders:read", "orders:write", "customers:read", "finance:read"] as const;
export type ApiKeyScope = (typeof apiKeyScopes)[number];

export const webhookEvents = ["order.created", "order.updated", "order.delivered", "order.refunded", "product.updated", "inventory.low_stock", "payout.paid", "review.created", "message.received"] as const;
export type WebhookEvent = (typeof webhookEvents)[number];

export interface ApiKey {
  readonly id: string;
  readonly name: string;
  readonly prefix: string;
  readonly scopes: ApiKeyScope[];
  readonly createdBy: string;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
}

export interface CreatedApiKey {
  readonly apiKey: ApiKey;
  readonly secret: string;
}

export interface WebhookEndpoint {
  readonly id: string;
  readonly url: string;
  readonly description: string;
  readonly events: WebhookEvent[];
  readonly active: boolean;
  readonly signingSecretPreview: string;
  readonly createdAt: string;
  readonly lastDeliveryAt: string | null;
  readonly recentFailureCount: number;
}

export interface CreatedWebhookEndpoint {
  readonly webhook: WebhookEndpoint;
  readonly signingSecret: string;
}

export interface WebhookDelivery {
  readonly id: string;
  readonly webhookId: string;
  readonly event: WebhookEvent;
  readonly responseStatus: number | null;
  readonly durationMilliseconds: number | null;
  readonly outcome: "delivered" | "failed" | "retrying";
  readonly attemptedAt: string;
}

export type IntegrationCategory = "accounting" | "spreadsheets" | "marketing" | "messaging";

export interface StoreIntegration {
  readonly id: "quickbooks" | "xero" | "zoho_books" | "google_sheets" | "meta_catalog" | "whatsapp_business";
  readonly name: string;
  readonly category: IntegrationCategory;
  readonly description: string;
  readonly requiredPlanFeature: "accounting_integrations" | null;
  readonly status: "connected" | "not_connected" | "needs_attention";
  readonly connectedAccount: string | null;
  readonly connectedAt: string | null;
  readonly lastSyncedAt: string | null;
}

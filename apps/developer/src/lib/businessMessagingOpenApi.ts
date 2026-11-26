import { readDeveloperDocsUrl, readSandboxPublicApiUrl } from "@/config/site.config";

export interface OpenApiSpecification {
  readonly openapi: "3.1.0";
  readonly info: {
    readonly title: string;
    readonly version: string;
    readonly summary: string;
    readonly description: string;
    readonly contact: { readonly name: string; readonly url: string };
  };
  readonly servers: readonly {
    readonly url: string;
    readonly description: string;
    readonly "x-environment": "sandbox" | "production";
  }[];
  readonly tags: readonly { readonly name: string; readonly description: string }[];
  readonly paths: Record<string, unknown>;
  readonly components: {
    readonly securitySchemes: Record<string, unknown>;
    readonly schemas: Record<string, unknown>;
  };
}

const errorEnvelopeSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: {
          type: "string",
          enum: [
            "UNAUTHORIZED",
            "INVALID_SANDBOX_CREDENTIAL",
            "INVALID_REQUEST",
            "INVALID_CUSTOMER",
            "INVALID_CONVERSATION",
            "CUSTOMER_NOT_FOUND",
            "CONVERSATION_NOT_FOUND",
            "IDEMPOTENCY_KEY_REQUIRED",
            "IDEMPOTENCY_CONFLICT",
            "SANDBOX_QUOTA_EXCEEDED",
            "APPLICATION_NOT_APPROVED",
            "INSUFFICIENT_SCOPE",
            "MONTHLY_QUOTA_EXCEEDED",
            "INVALID_CURSOR",
            "INVALID_LIMIT",
            "INVALID_MESSAGE_ID",
            "INVALID_RECIPIENT_ID",
            "BUSINESS_CONSENT_REQUIRED",
            "BUSINESS_STORE_AUTHORIZATION_REQUIRED",
            "INSUFFICIENT_BUSINESS_STORE_PERMISSION",
            "INVALID_STORE_ID",
            "MESSAGE_NOT_FOUND",
            "INVALID_AUTHORIZATION_CODE",
          ],
        },
        message: { type: "string" },
        details: {
          type: "object",
          additionalProperties: true,
          properties: {
            remaining: { type: "integer" },
            limit: { type: "integer" },
            resetAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
  },
} as const;

export function buildBusinessMessagingOpenApiSpec(): OpenApiSpecification {
  const docsUrl = readDeveloperDocsUrl();
  const sandboxUrl = readSandboxPublicApiUrl();

  return {
    openapi: "3.1.0",
    info: {
      title: "Nantty Business Messaging API",
      version: "2026-11-16",
      summary: "Sandbox messaging and consent-scoped production conversation/message reads.",
      description: [
        "The Sandbox Business Messaging HTTP API (`ntsb_test_` bearer tokens) is available for synthetic data.",
        "Production apps can use a short-lived S256 PKCE authorization code to receive a server-verified receipt for a customer's explicit store-scoped consent. The code is redeemed using the same application's active `ntlive_` credential; it does not issue a Nantty user access token. Production conversation listing and outbound-message history/status reads require an active merchant grant and customer consent for the same store and approved application, plus the corresponding live credential scopes. History currently reflects only messages persisted by this API; inbound message synchronization and delivery/read receipts are not yet connected. Sending remains unavailable until canonical encrypted dispatch is connected.",
        "Webhook deliveries are signed with HMAC-SHA256 in the `nantty-signature` (`t=<unix-seconds>,v1=<hex>`) header over `${timestamp}.${rawBody}` and carry a unique `nantty-event-id` for consumer deduplication.",
      ].join(" "),
      contact: { name: "Nantty Developers", url: docsUrl },
    },
    servers: [
      { url: sandboxUrl, description: "Nantty Sandbox API (test-only credentials `ntsb_test_`)", "x-environment": "sandbox" },
      { url: "https://api.nantty.com", description: "Production Business Messaging; conversation listing only until send integration is enabled", "x-environment": "production" },
    ],
    tags: [
      { name: "Sandbox Messaging", description: "Synthetic customer & conversation endpoints scoped to a Sandbox `ntsb_test_` credential." },
      { name: "Production Business Messaging", description: "Consent-scoped conversation, persisted outbound-message history, and status reads. Sending and inbound message synchronization remain unavailable pending canonical integrations." },
    ],
    paths: {
      "/v1/customers": {
        post: {
          tags: ["Sandbox Messaging"],
          summary: "Create or update a synthetic Sandbox customer",
          operationId: "createSandboxCustomer",
          security: [{ SandboxBearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["externalReference", "displayName"],
                  properties: {
                    externalReference: { type: "string", minLength: 1, maxLength: 128 },
                    displayName: { type: "string", minLength: 1, maxLength: 120 },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Synthetic customer created or updated", content: { "application/json": { schema: { $ref: "#/components/schemas/SandboxCustomer" } } } },
            "400": { description: "Invalid request body", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "401": { description: "Invalid or expired Sandbox credential", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          },
        },
      },
      "/v1/customers/{customerId}/conversations": {
        post: {
          tags: ["Sandbox Messaging"],
          summary: "Open a synthetic Sandbox conversation for a customer",
          operationId: "createSandboxConversation",
          security: [{ SandboxBearerAuth: [] }],
          parameters: [{ name: "customerId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "201": { description: "Synthetic conversation opened", content: { "application/json": { schema: { $ref: "#/components/schemas/SandboxConversation" } } } },
            "400": { description: "Invalid customerId", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "404": { description: "Sandbox customer not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          },
        },
      },
      "/v1/conversations/{conversationId}/messages": {
        get: {
          tags: ["Sandbox Messaging"],
          summary: "List messages in a Sandbox conversation (up to 100 latest)",
          operationId: "listSandboxMessages",
          security: [{ SandboxBearerAuth: [] }],
          parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Chronological Sandbox messages", content: { "application/json": { schema: { type: "object", required: ["messages"], properties: { messages: { type: "array", items: { $ref: "#/components/schemas/SandboxMessage" } } } } } } },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "404": { description: "Sandbox conversation not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          },
        },
        post: {
          tags: ["Sandbox Messaging"],
          summary: "Send an idempotent synthetic business message",
          operationId: "sendSandboxMessage",
          security: [{ SandboxBearerAuth: [] }],
          parameters: [
            { name: "conversationId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
            { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object", required: ["text"], properties: { text: { type: "string", minLength: 1, maxLength: 4000 } } },
              },
            },
          },
          responses: {
            "200": { description: "Idempotent replay of an earlier accepted message", content: { "application/json": { schema: { $ref: "#/components/schemas/SandboxMessage" } } } },
            "201": { description: "Synthetic business message created", content: { "application/json": { schema: { $ref: "#/components/schemas/SandboxMessage" } } } },
            "400": { description: "Missing Idempotency-Key or invalid text", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "404": { description: "Sandbox conversation not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "409": { description: "Idempotency-Key reused with different message payload", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "429": { description: "Monthly Sandbox message quota exceeded", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          },
        },
      },
      "/v1/events": {
        get: {
          tags: ["Sandbox Messaging"],
          summary: "List the latest Sandbox events for this application",
          operationId: "listSandboxEvents",
          security: [{ SandboxBearerAuth: [] }],
          responses: {
            "200": { description: "Up to 100 newest application-scoped Sandbox events", content: { "application/json": { schema: { type: "object", required: ["events"], properties: { events: { type: "array", items: { $ref: "#/components/schemas/SandboxEvent" } } } } } } },
            "401": { description: "Invalid or expired Sandbox credential", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          },
        },
      },
      "/api/v1/business/messages": {
        post: {
          tags: ["Production Business Messaging"],
          summary: "Send a business message (currently unavailable)",
          operationId: "sendBusinessMessage",
          "x-status": "unavailable",
          security: [{ BusinessBearerAuth: ["messages:send"] }],
          parameters: [
            { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["storeId", "recipientId", "text"],
                  properties: {
                    storeId: { type: "string", format: "uuid", description: "Store that has granted this application messages:send access." },
                    recipientId: { type: "string", format: "uuid" },
                    text: { type: "string", minLength: 1, maxLength: 4000 },
                  },
                },
              },
            },
          },
          responses: {
            "503": { description: "Production Business Messaging is not enabled; no message is sent", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          },
        },
      },
      "/api/v1/business/conversations": {
        get: {
          tags: ["Production Business Messaging"],
          summary: "List conversations with active consent for the authorized store",
          operationId: "listBusinessConversations",
          security: [{ BusinessBearerAuth: ["conversations:read"] }],
          parameters: [
            { name: "storeId", in: "query", required: true, schema: { type: "string", format: "uuid", description: "Store that granted this application conversations:read access." } },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
            { name: "cursor", in: "query", required: false, schema: { type: "string", description: "Opaque cursor returned by the preceding page." } },
          ],
          responses: {
            "200": { description: "Conversations with active customer consent for this exact store, ordered by recent activity", content: { "application/json": { schema: { type: "object", required: ["conversations", "nextCursor"], properties: { conversations: { type: "array", items: { type: "object", required: ["recipientId", "grantedAt", "lastStatus"], properties: { recipientId: { type: "string", format: "uuid" }, grantedAt: { type: "string", format: "date-time" }, lastStatus: { type: "string", enum: ["consented", "accepted", "dispatched", "failed"] }, lastMessageAt: { type: "string", format: "date-time" } } } }, nextCursor: { type: ["string", "null"] } } } } } },
            "401": { description: "Invalid production credential", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "403": { description: "Application not approved or credential lacks conversations:read", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "402": { description: "Organization has no active production entitlement", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "429": { description: "Organization production request quota exhausted", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "500": { description: "Conversation listing could not be completed", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          },
        },
      },
      "/api/v1/business/consent-codes/exchange": {
        post: {
          tags: ["Production Business Messaging"],
          summary: "Exchange a customer-approved consent code for its receipt",
          operationId: "exchangeBusinessConsentCode",
          security: [{ BusinessBearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["code", "redirectUri", "codeVerifier"],
                  properties: {
                    code: { type: "string", minLength: 43, maxLength: 43, description: "One-time code returned to the exact registered application redirect URI; expires after 60 seconds." },
                    redirectUri: { type: "string", format: "uri", maxLength: 2048, description: "The exact redirect URI used in the authorization request." },
                    codeVerifier: { type: "string", minLength: 43, maxLength: 128, description: "The original PKCE verifier. The matching S256 challenge was bound to this code before customer approval." },
                  },
                  additionalProperties: false,
                },
              },
            },
          },
          responses: {
            "200": { description: "Single-use receipt for the exact active customer, application, store, and approved scopes", content: { "application/json": { schema: { $ref: "#/components/schemas/BusinessConsentReceipt" } } } },
            "401": { description: "Credential or code is invalid, expired, replayed, revoked, or bound to another redirect/application", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "403": { description: "The application's active credential does not cover every customer-approved scope", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          },
        },
      },
      "/api/v1/business/conversations/{recipientId}/messages": {
        get: {
          tags: ["Production Business Messaging"],
          summary: "List persisted messages for an actively consented recipient",
          operationId: "listBusinessMessages",
          security: [{ BusinessBearerAuth: ["messages:read"] }],
          parameters: [
            { name: "recipientId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
            { name: "storeId", in: "query", required: true, schema: { type: "string", format: "uuid", description: "Store that granted this application messages:read access." } },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
            { name: "cursor", in: "query", required: false, schema: { type: "string", description: "Opaque cursor returned by the preceding page." } },
          ],
          responses: {
            "200": { description: "Messages in chronological order; nextCursor is null when exhausted", content: { "application/json": { schema: { type: "object", required: ["messages", "nextCursor"], properties: { messages: { type: "array", items: { $ref: "#/components/schemas/BusinessMessage" } }, nextCursor: { type: ["string", "null"] } } } } } },
            "400": { description: "Invalid recipient, limit or cursor", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "401": { description: "Invalid production credential", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "403": { description: "Credential scope or active recipient consent is insufficient", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "402": { description: "Organization has no active verified production entitlement", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "429": { description: "Organization production request quota exhausted", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          },
        },
      },
      "/api/v1/business/messages/{messageId}": {
        get: {
          tags: ["Production Business Messaging"],
          summary: "Get the current status of a persisted message",
          operationId: "getBusinessMessageStatus",
          security: [{ BusinessBearerAuth: ["messages:read"] }],
          parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Current persisted message status for the authorized application", content: { "application/json": { schema: { type: "object", required: ["message"], properties: { message: { $ref: "#/components/schemas/BusinessMessage" } } } } } },
            "401": { description: "Invalid production credential", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "403": { description: "Credential or recipient consent lacks messages:read", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "402": { description: "Organization has no active verified production entitlement", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "404": { description: "Message does not exist for this authorized application or consent is no longer active", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            "429": { description: "Organization production request quota exhausted", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        SandboxBearerAuth: { type: "http", scheme: "bearer", bearerFormat: "ntsb_test_<secret>", description: "Sandbox application credential (`ntsb_test_...`). Rejected on production routes." },
        BusinessBearerAuth: { type: "http", scheme: "bearer", bearerFormat: "ntlive_<secret>", description: "Production application credential (`ntlive_...`) issued for approved applications." },
      },
      schemas: {
        ErrorEnvelope: errorEnvelopeSchema,
        SandboxCustomer: {
          type: "object",
          required: ["id", "externalReference", "displayName", "createdAt"],
          properties: {
            id: { type: "string", format: "uuid" },
            externalReference: { type: "string" },
            displayName: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        SandboxConversation: {
          type: "object",
          required: ["id", "customerId", "status", "createdAt"],
          properties: {
            id: { type: "string", format: "uuid" },
            customerId: { type: "string", format: "uuid" },
            status: { type: "string", enum: ["open"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        SandboxMessage: {
          type: "object",
          required: ["id", "sender", "text", "status", "createdAt"],
          properties: {
            id: { type: "string", format: "uuid" },
            sender: { type: "string", enum: ["business", "customer"] },
            text: { type: "string" },
            status: { type: "string", enum: ["sent", "delivered", "read", "failed", "received"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        BusinessMessage: {
          type: "object",
          required: ["messageId", "recipientId", "text", "status", "createdAt", "updatedAt"],
          properties: {
            messageId: { type: "string", format: "uuid" },
            recipientId: { type: "string", format: "uuid" },
            text: { type: "string" },
            status: { type: "string", enum: ["accepted", "dispatched", "failed"] },
            externalMessageId: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        BusinessConsentReceipt: {
          type: "object",
          required: ["consentId", "applicationId", "storeId", "recipientAccountId", "scopes", "grantedAt"],
          properties: {
            consentId: { type: "string", format: "uuid" },
            applicationId: { type: "string", format: "uuid" },
            storeId: { type: "string", format: "uuid" },
            recipientAccountId: { type: "string", format: "uuid" },
            scopes: { type: "array", items: { type: "string", enum: ["messages:send", "messages:read", "conversations:read"] } },
            grantedAt: { type: "string", format: "date-time" },
          },
        },
        SandboxEvent: {
          type: "object",
          required: ["id", "eventType", "aggregateId", "data", "createdAt"],
          properties: {
            id: { type: "string", format: "uuid" },
            eventType: { type: "string" },
            aggregateId: { type: "string", format: "uuid" },
            data: { type: "object", additionalProperties: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        WebhookEnvelope: {
          type: "object",
          required: ["id", "event", "createdAt", "data"],
          description: "Signed with header `nantty-signature: t=<unix-seconds>,v1=<hmac-sha256-hex>` over `${timestamp}.${rawBody}` and deduplicated by `nantty-event-id`.",
          properties: {
            id: { type: "string", format: "uuid" },
            event: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            data: { type: "object", additionalProperties: true },
          },
        },
      },
    },
  };
}

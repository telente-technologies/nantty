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
      summary: "Live Sandbox Messaging API with a clearly unavailable Production contract preview.",
      description: [
        "The Sandbox Business Messaging HTTP API (`ntsb_test_` bearer tokens) is available for synthetic data.",
        "Production paths are preview-only: current production routes return 503 BUSINESS_MESSAGING_UNAVAILABLE and must not be used for live traffic.",
        "Webhook deliveries are signed with HMAC-SHA256 in the `nantty-signature` (`t=<unix-seconds>,v1=<hex>`) header over `${timestamp}.${rawBody}` and carry a unique `nantty-event-id` for consumer deduplication.",
      ].join(" "),
      contact: { name: "Nantty Developers", url: docsUrl },
    },
    servers: [
      { url: sandboxUrl, description: "Nantty Sandbox API (test-only credentials `ntsb_test_`)", "x-environment": "sandbox" },
      { url: "https://api.nantty.com", description: "Production route preview only; Business Messaging currently returns 503", "x-environment": "production" },
    ],
    tags: [
      { name: "Sandbox Messaging", description: "Synthetic customer & conversation endpoints scoped to a Sandbox `ntsb_test_` credential." },
      { name: "Production Business Messaging (unavailable)", description: "Preview only. These routes currently return 503 BUSINESS_MESSAGING_UNAVAILABLE; production functionality is not enabled." },
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
          summary: "Preview only — Production Business Messaging is unavailable",
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
                  required: ["recipientId", "text"],
                  properties: {
                    recipientId: { type: "string", minLength: 1 },
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
          summary: "Preview only — Production Business Messaging is unavailable",
          operationId: "listBusinessConversations",
          "x-status": "unavailable",
          security: [{ BusinessBearerAuth: ["conversations:read"] }],
          responses: {
            "503": { description: "Production Business Messaging is not enabled", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
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

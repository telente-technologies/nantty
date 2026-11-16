import { readDeveloperDocsUrl, readSandboxPortalUrl } from "@/config/site.config";

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
    readonly "x-environment": "sandbox" | "production-draft";
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
            "INVALID_REQUEST",
            "INVALID_CUSTOMER",
            "INVALID_CONVERSATION",
            "CUSTOMER_NOT_FOUND",
            "CONVERSATION_NOT_FOUND",
            "IDEMPOTENCY_KEY_REQUIRED",
            "IDEMPOTENCY_CONFLICT",
            "SANDBOX_QUOTA_EXCEEDED",
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
  const sandboxUrl = readSandboxPortalUrl();

  return {
    openapi: "3.1.0",
    info: {
      title: "Nantty Business Messaging API",
      version: "2026-11-16",
      summary: "Implemented Sandbox Messaging contract and proposed v1 Production contract.",
      description: [
        "Documents the live Sandbox Business Messaging HTTP API (`ntsb_test_` bearer tokens)",
        "and the proposed v1 Production Business Messaging draft routes (not yet mounted on the production API gateway).",
        "Webhook deliveries are signed with HMAC-SHA256 in the `nantty-signature` (`t=<unix-seconds>,v1=<hex>`) header over `${timestamp}.${rawBody}` and carry a unique `nantty-event-id` for consumer deduplication.",
      ].join(" "),
      contact: { name: "Nantty Developers", url: docsUrl },
    },
    servers: [
      { url: sandboxUrl, description: "Nantty Sandbox API (test-only credentials `ntsb_test_`)", "x-environment": "sandbox" },
      { url: "https://api.nantty.com", description: "Proposed Production API gateway (draft contract — requests disabled)", "x-environment": "production-draft" },
    ],
    tags: [
      { name: "Sandbox Messaging", description: "Implemented synthetic customer & conversation endpoints scoped to a Sandbox `ntsb_test_` credential." },
      { name: "Production Draft (Disabled)", description: "Proposed v1 Business Messaging contract routes; not mounted in production." },
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
      "/v1/business/messages": {
        post: {
          tags: ["Production Draft (Disabled)"],
          summary: "Send an authorized production business message (proposed draft — not live)",
          "x-status": "draft",
          security: [{ BusinessBearerAuth: ["messages:send"] }],
          parameters: [{ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } }],
          responses: {
            "202": { description: "Message queued for asynchronous delivery (proposed contract)" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        SandboxBearerAuth: { type: "http", scheme: "bearer", bearerFormat: "ntsb_test_<secret>", description: "Sandbox application credential (`ntsb_test_...`). Rejected on production routes." },
        BusinessBearerAuth: { type: "http", scheme: "bearer", description: "Proposed business-scoped production access token (not yet active)." },
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

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
export type EndpointAvailability = "live" | "read" | "preview";
export type SampleLanguage = "curl" | "node" | "python" | "go";

export interface EndpointFieldSpec {
  readonly name: string;
  readonly type: string;
  readonly required?: boolean;
  readonly description: string;
  readonly constraints?: string;
}

export interface EndpointResponseSample {
  readonly status: number;
  readonly label: string;
  readonly tone: "success" | "warn" | "danger";
  readonly description: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

export interface ApiEndpointDoc {
  readonly id: string;
  readonly group: "Sandbox Messaging" | "Production Business Messaging" | "Webhooks & Security";
  readonly method: HttpMethod;
  readonly baseUrl: string;
  readonly path: string;
  readonly title: string;
  readonly summary: string;
  readonly statusLabel: string;
  readonly statusTone: EndpointAvailability;
  readonly updatedAt: string;
  readonly authLabel: string;
  readonly scopes: readonly string[];
  readonly headers: readonly EndpointFieldSpec[];
  readonly pathParams?: readonly EndpointFieldSpec[];
  readonly queryParams?: readonly EndpointFieldSpec[];
  readonly bodyParams?: readonly EndpointFieldSpec[];
  readonly samples: Readonly<Record<SampleLanguage, string>>;
  readonly responses: readonly EndpointResponseSample[];
}

export const apiReferenceEndpoints: readonly ApiEndpointDoc[] = [
  {
    id: "create-customer",
    group: "Sandbox Messaging",
    method: "POST",
    baseUrl: "https://sandbox-api.nantty.com",
    path: "/v1/customers",
    title: "Create or update synthetic customer",
    summary: "Creates or updates a synthetic customer record scoped to your Sandbox application so you can open test conversations.",
    statusLabel: "Sandbox Live",
    statusTone: "live",
    updatedAt: "Nov 16, 2026",
    authLabel: "Bearer ntsb_test_...",
    scopes: ["sandbox:write"],
    headers: [
      { name: "Authorization", type: "string", required: true, description: "Sandbox API credential prefixed with ntsb_test_." },
      { name: "Content-Type", type: "string", required: true, description: "Must be application/json." },
    ],
    bodyParams: [
      { name: "externalReference", type: "string", required: true, description: "Deterministic partner customer identifier within this Sandbox app.", constraints: "1–128 chars" },
      { name: "displayName", type: "string", required: true, description: "Synthetic customer display name shown in Sandbox tools.", constraints: "1–120 chars" },
    ],
    samples: {
      curl: `curl -X POST "https://sandbox-api.nantty.com/v1/customers" \\
  -H "Authorization: Bearer <ntsb_test_key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "externalReference": "cust-lagos-001",
    "displayName": "Ada Obi"
  }'`,
      node: `const response = await fetch("https://sandbox-api.nantty.com/v1/customers", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.SANDBOX_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    externalReference: "cust-lagos-001",
    displayName: "Ada Obi",
  }),
});

const customer = await response.json();`,
      python: `import os, requests

resp = requests.post(
    "https://sandbox-api.nantty.com/v1/customers",
    headers={"Authorization": f"Bearer {os.environ['SANDBOX_KEY']}"},
    json={
        "externalReference": "cust-lagos-001",
        "displayName": "Ada Obi",
    },
    timeout=10,
)
customer = resp.json()`,
      go: `payload := strings.NewReader(\`{"externalReference":"cust-lagos-001","displayName":"Ada Obi"}\`)
req, _ := http.NewRequest("POST", "https://sandbox-api.nantty.com/v1/customers", payload)
req.Header.Set("Authorization", "Bearer "+os.Getenv("SANDBOX_KEY"))
req.Header.Set("Content-Type", "application/json")
res, err := http.DefaultClient.Do(req)`,
    },
    responses: [
      {
        status: 201,
        label: "201 Created",
        tone: "success",
        description: "Synthetic customer created or updated cleanly under your application.",
        headers: { "Content-Type": "application/json", "X-Request-Id": "req_01JCYA9T8K4Q" },
        body: {
          id: "7f4b9c21-22c1-4d8e-9a4b-6f2d80c14b22",
          externalReference: "cust-lagos-001",
          displayName: "Ada Obi",
          createdAt: "2026-11-16T10:15:00Z",
        },
      },
      {
        status: 400,
        label: "400 Bad Request",
        tone: "warn",
        description: "Missing or invalid externalReference or displayName.",
        headers: { "Content-Type": "application/json", "X-Request-Id": "req_01JCYAA13F92" },
        body: {
          error: {
            code: "INVALID_REQUEST",
            message: "displayName must be between 1 and 120 characters.",
          },
        },
      },
      {
        status: 401,
        label: "401 Unauthorized",
        tone: "danger",
        description: "Credential missing, revoked, expired, or production token passed to Sandbox.",
        headers: { "Content-Type": "application/json" },
        body: {
          error: {
            code: "INVALID_SANDBOX_CREDENTIAL",
            message: "Provide an active ntsb_test_ bearer credential.",
          },
        },
      },
    ],
  },
  {
    id: "create-conversation",
    group: "Sandbox Messaging",
    method: "POST",
    baseUrl: "https://sandbox-api.nantty.com",
    path: "/v1/customers/{customerId}/conversations",
    title: "Open synthetic conversation",
    summary: "Opens an isolated Sandbox conversation thread for an existing synthetic customer.",
    statusLabel: "Sandbox Live",
    statusTone: "live",
    updatedAt: "Nov 16, 2026",
    authLabel: "Bearer ntsb_test_...",
    scopes: ["sandbox:write"],
    headers: [
      { name: "Authorization", type: "string", required: true, description: "Sandbox API credential prefixed with ntsb_test_." },
    ],
    pathParams: [
      { name: "customerId", type: "string (uuid)", required: true, description: "UUID of the synthetic customer returned by POST /v1/customers." },
    ],
    samples: {
      curl: `curl -X POST "https://sandbox-api.nantty.com/v1/customers/7f4b9c21-22c1-4d8e-9a4b-6f2d80c14b22/conversations" \\
  -H "Authorization: Bearer <ntsb_test_key>"`,
      node: `const customerId = "7f4b9c21-22c1-4d8e-9a4b-6f2d80c14b22";
const response = await fetch(\`https://sandbox-api.nantty.com/v1/customers/\${customerId}/conversations\`, {
  method: "POST",
  headers: { "Authorization": \`Bearer \${process.env.SANDBOX_KEY}\` },
});
const conversation = await response.json();`,
      python: `customer_id = "7f4b9c21-22c1-4d8e-9a4b-6f2d80c14b22"
resp = requests.post(
    f"https://sandbox-api.nantty.com/v1/customers/{customer_id}/conversations",
    headers={"Authorization": f"Bearer {os.environ['SANDBOX_KEY']}"},
    timeout=10,
)`,
      go: `req, _ := http.NewRequest("POST", "https://sandbox-api.nantty.com/v1/customers/7f4b9c21-22c1-4d8e-9a4b-6f2d80c14b22/conversations", nil)
req.Header.Set("Authorization", "Bearer "+os.Getenv("SANDBOX_KEY"))
res, err := http.DefaultClient.Do(req)`,
    },
    responses: [
      {
        status: 201,
        label: "201 Created",
        tone: "success",
        description: "Synthetic conversation opened for the customer.",
        headers: { "Content-Type": "application/json", "X-Request-Id": "req_01JCYAB42M11" },
        body: {
          id: "3a81e70d-9c52-4a2b-8f13-0e5c8b4e1190",
          customerId: "7f4b9c21-22c1-4d8e-9a4b-6f2d80c14b22",
          status: "open",
          createdAt: "2026-11-16T10:16:12Z",
        },
      },
      {
        status: 400,
        label: "400 Bad Request",
        tone: "warn",
        description: "customerId is not a valid UUID.",
        headers: { "Content-Type": "application/json" },
        body: {
          error: { code: "INVALID_CUSTOMER", message: "customerId must be a valid UUID." },
        },
      },
      {
        status: 401,
        label: "401 Unauthorized",
        tone: "danger",
        description: "Missing or invalid ntsb_test_ credential.",
        headers: { "Content-Type": "application/json" },
        body: {
          error: { code: "UNAUTHORIZED", message: "Authentication required." },
        },
      },
      {
        status: 404,
        label: "404 Not Found",
        tone: "warn",
        description: "No customer with this ID exists in your Sandbox application.",
        headers: { "Content-Type": "application/json" },
        body: {
          error: { code: "CUSTOMER_NOT_FOUND", message: "Sandbox customer not found." },
        },
      },
    ],
  },
  {
    id: "send-sandbox-message",
    group: "Sandbox Messaging",
    method: "POST",
    baseUrl: "https://sandbox-api.nantty.com",
    path: "/v1/conversations/{conversationId}/messages",
    title: "Send idempotent Sandbox message",
    summary: "Sends a synthetic business message into an open Sandbox conversation with strict idempotency protection and monthly quota enforcement.",
    statusLabel: "Sandbox Live",
    statusTone: "live",
    updatedAt: "Nov 16, 2026",
    authLabel: "Bearer ntsb_test_...",
    scopes: ["messages:send"],
    headers: [
      { name: "Authorization", type: "string", required: true, description: "Sandbox credential prefixed with ntsb_test_." },
      { name: "Idempotency-Key", type: "string", required: true, description: "Unique request token preventing duplicate sends on network retry.", constraints: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" },
      { name: "Content-Type", type: "string", required: true, description: "Must be application/json." },
    ],
    pathParams: [
      { name: "conversationId", type: "string (uuid)", required: true, description: "UUID of the Sandbox conversation." },
    ],
    bodyParams: [
      { name: "text", type: "string", required: true, description: "Plain text message body delivered into the synthetic conversation.", constraints: "1–4000 chars" },
    ],
    samples: {
      curl: `curl -X POST "https://sandbox-api.nantty.com/v1/conversations/3a81e70d-9c52-4a2b-8f13-0e5c8b4e1190/messages" \\
  -H "Authorization: Bearer <ntsb_test_key>" \\
  -H "Idempotency-Key: idem-001" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Your order #8421 is ready for pickup in Benin City."
  }'`,
      node: `const res = await fetch(
  "https://sandbox-api.nantty.com/v1/conversations/3a81e70d-9c52-4a2b-8f13-0e5c8b4e1190/messages",
  {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${process.env.SANDBOX_KEY}\`,
      "Idempotency-Key": "idem-001",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: "Your order #8421 is ready for pickup in Benin City.",
    }),
  },
);
const message = await res.json();`,
      python: `resp = requests.post(
    "https://sandbox-api.nantty.com/v1/conversations/3a81e70d-9c52-4a2b-8f13-0e5c8b4e1190/messages",
    headers={
        "Authorization": f"Bearer {os.environ['SANDBOX_KEY']}",
        "Idempotency-Key": "idem-001",
    },
    json={"text": "Your order #8421 is ready for pickup in Benin City."},
    timeout=10,
)`,
      go: `body := strings.NewReader(\`{"text":"Your order #8421 is ready for pickup in Benin City."}\`)
req, _ := http.NewRequest("POST", "https://sandbox-api.nantty.com/v1/conversations/3a81e70d-9c52-4a2b-8f13-0e5c8b4e1190/messages", body)
req.Header.Set("Authorization", "Bearer "+os.Getenv("SANDBOX_KEY"))
req.Header.Set("Idempotency-Key", "idem-001")
req.Header.Set("Content-Type", "application/json")
res, err := http.DefaultClient.Do(req)`,
    },
    responses: [
      {
        status: 201,
        label: "201 Created",
        tone: "success",
        description: "Synthetic message accepted and queued for webhook delivery.",
        headers: { "Content-Type": "application/json", "X-Request-Id": "req_01JCYAC99E04" },
        body: {
          id: "msg_01JCYAC99D8P7Q",
          conversationId: "3a81e70d-9c52-4a2b-8f13-0e5c8b4e1190",
          direction: "outbound",
          status: "queued",
          text: "Your order #8421 is ready for pickup in Benin City.",
          createdAt: "2026-11-16T10:18:04Z",
        },
      },
      {
        status: 200,
        label: "200 Replay",
        tone: "success",
        description: "Idempotent replay: same Idempotency-Key and identical body returns original resource without double-sending.",
        headers: { "Content-Type": "application/json", "Idempotent-Replayed": "true", "X-Request-Id": "req_01JCYAD04X7A" },
        body: {
          id: "msg_01JCYAC99D8P7Q",
          conversationId: "3a81e70d-9c52-4a2b-8f13-0e5c8b4e1190",
          direction: "outbound",
          status: "queued",
          text: "Your order #8421 is ready for pickup in Benin City.",
          createdAt: "2026-11-16T10:18:04Z",
        },
      },
      {
        status: 400,
        label: "400 Bad Request",
        tone: "warn",
        description: "Missing or malformed Idempotency-Key header or invalid message body.",
        headers: { "Content-Type": "application/json" },
        body: {
          error: {
            code: "IDEMPOTENCY_KEY_REQUIRED",
            message: "Provide a valid Idempotency-Key header matching ^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$.",
          },
        },
      },
      {
        status: 401,
        label: "401 Unauthorized",
        tone: "danger",
        description: "Missing, expired, or revoked Sandbox credential.",
        headers: { "Content-Type": "application/json" },
        body: {
          error: { code: "INVALID_SANDBOX_CREDENTIAL", message: "Sandbox bearer token is invalid or revoked." },
        },
      },
      {
        status: 404,
        label: "404 Not Found",
        tone: "warn",
        description: "Target Sandbox conversation does not exist for this application.",
        headers: { "Content-Type": "application/json" },
        body: {
          error: { code: "CONVERSATION_NOT_FOUND", message: "Sandbox conversation not found." },
        },
      },
      {
        status: 409,
        label: "409 Conflict",
        tone: "warn",
        description: "Idempotency-Key was previously used with a different message text.",
        headers: { "Content-Type": "application/json" },
        body: {
          error: {
            code: "IDEMPOTENCY_CONFLICT",
            message: "Idempotency-Key was already used with a different request payload.",
          },
        },
      },
      {
        status: 429,
        label: "429 Quota",
        tone: "danger",
        description: "Monthly Sandbox message quota exhausted; includes reset timestamp.",
        headers: { "Content-Type": "application/json" },
        body: {
          error: {
            code: "SANDBOX_QUOTA_EXCEEDED",
            message: "Monthly Sandbox message allowance reached.",
            details: { limit: 10000, remaining: 0, resetAt: "2026-12-01T00:00:00Z" },
          },
        },
      },
    ],
  },
  {
    id: "list-sandbox-messages",
    group: "Sandbox Messaging",
    method: "GET",
    baseUrl: "https://sandbox-api.nantty.com",
    path: "/v1/conversations/{conversationId}/messages",
    title: "List Sandbox messages",
    summary: "Returns up to 100 latest messages in chronological order for a synthetic Sandbox conversation.",
    statusLabel: "Sandbox Live",
    statusTone: "live",
    updatedAt: "Nov 16, 2026",
    authLabel: "Bearer ntsb_test_...",
    scopes: ["messages:read"],
    headers: [
      { name: "Authorization", type: "string", required: true, description: "Sandbox credential prefixed with ntsb_test_." },
    ],
    pathParams: [
      { name: "conversationId", type: "string (uuid)", required: true, description: "UUID of the Sandbox conversation." },
    ],
    samples: {
      curl: `curl "https://sandbox-api.nantty.com/v1/conversations/3a81e70d-9c52-4a2b-8f13-0e5c8b4e1190/messages" \\
  -H "Authorization: Bearer <ntsb_test_key>"`,
      node: `const res = await fetch(
  "https://sandbox-api.nantty.com/v1/conversations/3a81e70d-9c52-4a2b-8f13-0e5c8b4e1190/messages",
  { headers: { "Authorization": \`Bearer \${process.env.SANDBOX_KEY}\` } },
);
const { messages } = await res.json();`,
      python: `resp = requests.get(
    "https://sandbox-api.nantty.com/v1/conversations/3a81e70d-9c52-4a2b-8f13-0e5c8b4e1190/messages",
    headers={"Authorization": f"Bearer {os.environ['SANDBOX_KEY']}"},
    timeout=10,
)`,
      go: `req, _ := http.NewRequest("GET", "https://sandbox-api.nantty.com/v1/conversations/3a81e70d-9c52-4a2b-8f13-0e5c8b4e1190/messages", nil)
req.Header.Set("Authorization", "Bearer "+os.Getenv("SANDBOX_KEY"))
res, err := http.DefaultClient.Do(req)`,
    },
    responses: [
      {
        status: 200,
        label: "200 OK",
        tone: "success",
        description: "Chronological list of messages in the synthetic conversation.",
        headers: { "Content-Type": "application/json", "X-Request-Id": "req_01JCYAE18P02" },
        body: {
          messages: [
            {
              id: "msg_01JCYAB99A11",
              conversationId: "3a81e70d-9c52-4a2b-8f13-0e5c8b4e1190",
              direction: "inbound",
              status: "delivered",
              text: "Hi, when does my parcel arrive?",
              createdAt: "2026-11-16T10:17:02Z",
            },
            {
              id: "msg_01JCYAC99D8P7Q",
              conversationId: "3a81e70d-9c52-4a2b-8f13-0e5c8b4e1190",
              direction: "outbound",
              status: "delivered",
              text: "Your order #8421 is ready for pickup in Benin City.",
              createdAt: "2026-11-16T10:18:04Z",
            },
          ],
        },
      },
      {
        status: 401,
        label: "401 Unauthorized",
        tone: "danger",
        description: "Missing or invalid Sandbox credential.",
        headers: { "Content-Type": "application/json" },
        body: { error: { code: "UNAUTHORIZED", message: "Invalid Sandbox credential." } },
      },
      {
        status: 404,
        label: "404 Not Found",
        tone: "warn",
        description: "Conversation ID does not exist under this application.",
        headers: { "Content-Type": "application/json" },
        body: { error: { code: "CONVERSATION_NOT_FOUND", message: "Sandbox conversation not found." } },
      },
    ],
  },
  {
    id: "list-sandbox-events",
    group: "Sandbox Messaging",
    method: "GET",
    baseUrl: "https://sandbox-api.nantty.com",
    path: "/v1/events",
    title: "List Sandbox events",
    summary: "Lists up to 100 newest Sandbox webhook and lifecycle events recorded for your application.",
    statusLabel: "Sandbox Live",
    statusTone: "live",
    updatedAt: "Nov 16, 2026",
    authLabel: "Bearer ntsb_test_...",
    scopes: ["events:read"],
    headers: [
      { name: "Authorization", type: "string", required: true, description: "Sandbox credential prefixed with ntsb_test_." },
    ],
    samples: {
      curl: `curl "https://sandbox-api.nantty.com/v1/events" \\
  -H "Authorization: Bearer <ntsb_test_key>"`,
      node: `const res = await fetch("https://sandbox-api.nantty.com/v1/events", {
  headers: { "Authorization": \`Bearer \${process.env.SANDBOX_KEY}\` },
});
const { events } = await res.json();`,
      python: `resp = requests.get(
    "https://sandbox-api.nantty.com/v1/events",
    headers={"Authorization": f"Bearer {os.environ['SANDBOX_KEY']}"},
    timeout=10,
)`,
      go: `req, _ := http.NewRequest("GET", "https://sandbox-api.nantty.com/v1/events", nil)
req.Header.Set("Authorization", "Bearer "+os.Getenv("SANDBOX_KEY"))
res, err := http.DefaultClient.Do(req)`,
    },
    responses: [
      {
        status: 200,
        label: "200 OK",
        tone: "success",
        description: "Up to 100 newest application-scoped Sandbox events.",
        headers: { "Content-Type": "application/json" },
        body: {
          events: [
            {
              id: "9b4d7c1e-8c1a-4c6e-a0e1-7a9b2f10c312",
              event: "message.delivered",
              createdAt: "2026-11-16T10:18:06Z",
              data: { messageId: "msg_01JCYAC99D8P7Q", status: "delivered" },
            },
          ],
        },
      },
      {
        status: 401,
        label: "401 Unauthorized",
        tone: "danger",
        description: "Invalid or expired Sandbox credential.",
        headers: { "Content-Type": "application/json" },
        body: { error: { code: "INVALID_SANDBOX_CREDENTIAL", message: "Sandbox credential is invalid or expired." } },
      },
    ],
  },
  {
    id: "list-business-conversations",
    group: "Production Business Messaging",
    method: "GET",
    baseUrl: "https://api.nantty.com",
    path: "/api/v1/business/conversations",
    title: "List consented business conversations",
    summary: "Lists production business conversations where recipient consent is active for an approved application holding the conversations:read scope.",
    statusLabel: "Production Consent Read",
    statusTone: "read",
    updatedAt: "Nov 16, 2026",
    authLabel: "Bearer ntlive_...",
    scopes: ["conversations:read"],
    headers: [
      { name: "Authorization", type: "string", required: true, description: "Approved production key prefixed with ntlive_." },
    ],
    queryParams: [
      { name: "limit", type: "integer", required: false, description: "Number of consented conversations per page (1–100).", constraints: "default 20" },
      { name: "cursor", type: "string", required: false, description: "Opaque pagination cursor from the previous response." },
    ],
    samples: {
      curl: `curl "https://api.nantty.com/api/v1/business/conversations?limit=20" \\
  -H "Authorization: Bearer <ntlive_key>"`,
      node: `const res = await fetch("https://api.nantty.com/api/v1/business/conversations?limit=20", {
  headers: { "Authorization": \`Bearer \${process.env.LIVE_KEY}\` },
});
const conversations = await res.json();`,
      python: `resp = requests.get(
    "https://api.nantty.com/api/v1/business/conversations",
    params={"limit": 20},
    headers={"Authorization": f"Bearer {os.environ['LIVE_KEY']}"},
    timeout=10,
)`,
      go: `req, _ := http.NewRequest("GET", "https://api.nantty.com/api/v1/business/conversations?limit=20", nil)
req.Header.Set("Authorization", "Bearer "+os.Getenv("LIVE_KEY"))
res, err := http.DefaultClient.Do(req)`,
    },
    responses: [
      {
        status: 200,
        label: "200 OK",
        tone: "success",
        description: "Consented business conversations returned for this approved application.",
        headers: { "Content-Type": "application/json", "X-Request-Id": "req_prod_01JCYAG88" },
        body: {
          conversations: [
            {
              id: "conv_prod_849102",
              consentStatus: "active",
              updatedAt: "2026-11-16T09:42:10Z",
            },
          ],
          nextCursor: null,
        },
      },
      {
        status: 401,
        label: "401 Unauthorized",
        tone: "danger",
        description: "Missing or invalid ntlive_ key, or ntsb_test_ key sent to production.",
        headers: { "Content-Type": "application/json" },
        body: { error: { code: "UNAUTHORIZED", message: "Valid production ntlive_ credential required." } },
      },
      {
        status: 403,
        label: "403 Forbidden",
        tone: "warn",
        description: "Application is not approved or credential lacks conversations:read scope.",
        headers: { "Content-Type": "application/json" },
        body: { error: { code: "INSUFFICIENT_SCOPE", message: "Credential requires conversations:read scope." } },
      },
      {
        status: 429,
        label: "429 Quota",
        tone: "danger",
        description: "Organization monthly quota exceeded.",
        headers: { "Content-Type": "application/json" },
        body: { error: { code: "MONTHLY_QUOTA_EXCEEDED", message: "Monthly organization quota exceeded." } },
      },
    ],
  },
  {
    id: "send-business-message",
    group: "Production Business Messaging",
    method: "POST",
    baseUrl: "https://api.nantty.com",
    path: "/api/v1/business/messages",
    title: "Send production business message",
    summary: "Contract preview for sending consented production business messages. Currently returns 503 until canonical consent and dispatch pipelines are enabled.",
    statusLabel: "Unavailable · 503",
    statusTone: "preview",
    updatedAt: "Nov 16, 2026",
    authLabel: "Bearer ntlive_...",
    scopes: ["messages:send"],
    headers: [
      { name: "Authorization", type: "string", required: true, description: "Approved production key prefixed with ntlive_." },
      { name: "Idempotency-Key", type: "string", required: true, description: "Durable client-generated key scoped to your application.", constraints: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" },
    ],
    bodyParams: [
      { name: "conversationId", type: "string", required: true, description: "Consented business conversation identifier." },
      { name: "text", type: "string", required: true, description: "Outbound message body.", constraints: "1–4000 chars" },
    ],
    samples: {
      curl: `curl -X POST "https://api.nantty.com/api/v1/business/messages" \\
  -H "Authorization: Bearer <ntlive_key>" \\
  -H "Idempotency-Key: idem-002" \\
  -H "Content-Type: application/json" \\
  -d '{
    "conversationId": "conv_prod_849102",
    "text": "Your support ticket has been updated."
  }'`,
      node: `const res = await fetch("https://api.nantty.com/api/v1/business/messages", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.LIVE_KEY}\`,
    "Idempotency-Key": "idem-002",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    conversationId: "conv_prod_849102",
    text: "Your support ticket has been updated.",
  }),
});`,
      python: `resp = requests.post(
    "https://api.nantty.com/api/v1/business/messages",
    headers={
        "Authorization": f"Bearer {os.environ['LIVE_KEY']}",
        "Idempotency-Key": "idem-002",
    },
    json={"conversationId": "conv_prod_849102", "text": "Your support ticket has been updated."},
    timeout=10,
)`,
      go: `body := strings.NewReader(\`{"conversationId":"conv_prod_849102","text":"Your support ticket has been updated."}\`)
req, _ := http.NewRequest("POST", "https://api.nantty.com/api/v1/business/messages", body)
req.Header.Set("Authorization", "Bearer "+os.Getenv("LIVE_KEY"))
req.Header.Set("Idempotency-Key", "idem-002")
req.Header.Set("Content-Type", "application/json")
res, err := http.DefaultClient.Do(req)`,
    },
    responses: [
      {
        status: 503,
        label: "503 Unavailable",
        tone: "danger",
        description: "Expected current response: production send dispatch remains gated pending canonical consent rollout.",
        headers: { "Content-Type": "application/json", "X-Request-Id": "req_prod_01JCYAH12" },
        body: {
          error: {
            code: "BUSINESS_MESSAGING_UNAVAILABLE",
            message: "Production Business Messaging sends are currently disabled. Use Sandbox (/v1/conversations/{id}/messages) for integration testing.",
          },
        },
      },
      {
        status: 403,
        label: "403 Forbidden",
        tone: "warn",
        description: "Application is unapproved or credential lacks messages:send scope.",
        headers: { "Content-Type": "application/json" },
        body: { error: { code: "APPLICATION_NOT_APPROVED", message: "Application approval is required for production keys." } },
      },
      {
        status: 401,
        label: "401 Unauthorized",
        tone: "danger",
        description: "Missing or invalid ntlive_ credential.",
        headers: { "Content-Type": "application/json" },
        body: { error: { code: "UNAUTHORIZED", message: "Invalid production credential." } },
      },
    ],
  },
  {
    id: "verify-webhook",
    group: "Webhooks & Security",
    method: "POST",
    baseUrl: "https://api.nantty.com",
    path: "/api/v1/developer/organizations/{orgId}/applications/{appId}/webhooks/{webhookId}/verify",
    title: "Verify webhook ownership & HMAC",
    summary: "Sends a signed ownership challenge to your HTTPS webhook URL, validating DNS and public-IP SSRF protections before activating deliveries.",
    statusLabel: "Control Plane Active",
    statusTone: "live",
    updatedAt: "Nov 17, 2026",
    authLabel: "Developer Portal Session",
    scopes: ["webhooks.manage"],
    headers: [
      { name: "Authorization", type: "string", required: true, description: "Developer session bearer token with webhooks.manage grant." },
    ],
    pathParams: [
      { name: "orgId", type: "string (uuid)", required: true, description: "Developer organization UUID." },
      { name: "appId", type: "string (uuid)", required: true, description: "Application UUID." },
      { name: "webhookId", type: "string (uuid)", required: true, description: "Registered HTTPS webhook UUID." },
    ],
    samples: {
      curl: `// Your webhook server receives:
// Header: nantty-signature: t=1763337600,v1=<hmac_sha256_hex>
// Body:   {"type":"webhook.verification","challenge":"ch_test_..."}
// Respond 200 OK with:
{"challenge": "ch_test_..."}`,
      node: `import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyNanttyWebhook(rawBody: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const ts = Number(parts.t);
  if (!Number.isSafeInteger(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected = createHmac("sha256", secret).update(\`\${parts.t}.\${rawBody}\`).digest("hex");
  const provided = /^[a-f0-9]{64}$/i.test(parts.v1 ?? "") ? Buffer.from(parts.v1, "hex") : Buffer.alloc(0);
  return provided.length === 32 && timingSafeEqual(provided, Buffer.from(expected, "hex"));
}`,
      python: `import hmac, hashlib, time

def verify_nantty_webhook(raw_body: bytes, header: str, secret: str) -> bool:
    parts = dict(item.split("=", 1) for item in header.split(",") if "=" in item)
    ts = int(parts.get("t", "0"))
    if abs(time.time() - ts) > 300:
        return False
    signed = f"{ts}.".encode() + raw_body
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, parts.get("v1", ""))`,
      go: `func VerifyNanttyWebhook(rawBody []byte, header, secret string) bool {
	// Parse t=<unix>,v1=<hex> and verify abs(now - t) <= 300
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "."))
	mac.Write(rawBody)
	expected := mac.Sum(nil)
	provided, err := hex.DecodeString(v1Hex)
	return err == nil && hmac.Equal(expected, provided)
}`,
    },
    responses: [
      {
        status: 200,
        label: "200 Verified",
        tone: "success",
        description: "Endpoint responded with matching challenge and passed DNS + connect-time public-IP SSRF checks.",
        headers: { "Content-Type": "application/json" },
        body: {
          id: "wh_01JCYAJ50B12",
          verified: true,
          verifiedAt: "2026-11-17T08:12:00Z",
        },
      },
      {
        status: 422,
        label: "422 Challenge Failed",
        tone: "warn",
        description: "Endpoint timed out, returned non-2xx, or echoed an incorrect challenge value.",
        headers: { "Content-Type": "application/json" },
        body: {
          code: "WEBHOOK_VERIFICATION_FAILED",
          message: "Webhook endpoint did not echo the expected challenge token.",
        },
      },
      {
        status: 400,
        label: "400 SSRF Blocked",
        tone: "danger",
        description: "Target URL resolved to a non-public, loopback, link-local, or private network address.",
        headers: { "Content-Type": "application/json" },
        body: {
          code: "INVALID_WEBHOOK_TARGET",
          message: "Webhook endpoints must resolve to publicly routable HTTPS hosts.",
        },
      },
    ],
  },
];

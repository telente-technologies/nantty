export const sandboxNavigationGroups = [
  {
    label: "Test",
    items: [
      { href: "/test-apps", label: "Test applications", icon: "testApps" },
      { href: "/explorer", label: "API explorer", icon: "requests" },
      { href: "/messaging", label: "Messaging scenarios", icon: "messaging" },
      { href: "/scenarios", label: "Scenarios", icon: "scenarios" },
    ],
  },
  {
    label: "Inspect",
    items: [
      { href: "/events", label: "Webhook events", icon: "webhook" },
      { href: "/requests", label: "Request log", icon: "activity" },
      { href: "/docs", label: "Sandbox guide", icon: "book" },
    ],
  },
] as const;

type SandboxNavigationSection = (typeof sandboxNavigationGroups)[number]["items"][number];
export const sandboxSections: SandboxNavigationSection[] = sandboxNavigationGroups.reduce<SandboxNavigationSection[]>((sections, group) => {
  sections.push(...group.items);
  return sections;
}, []);

export type SandboxSectionKey = keyof typeof sandboxSectionDetails;

export const sandboxSectionDetails = {
  "test-apps": {
    title: "Test applications",
    description: "Issue, rotate, and revoke isolated ntsb_test_ credentials that cannot access production data or services.",
    availability: "Isolated sandbox control plane",
    detail: "Credentials issued here use the ntsb_test_ prefix and are scoped strictly to your selected organization and application.",
    releaseGates: ["Environment-bound ntsb_test_ credential issuer", "Daily request, webhook, and reset quotas", "Server-side rejection of production credentials"],
  },
  explorer: {
    title: "API explorer",
    description: "Make scoped requests against the isolated sandbox API using an ntsb_test_ token.",
    availability: "Isolated sandbox API",
    detail: "Requests execute server-side against the configured SANDBOX_API_BASE_URL and reject any non-ntsb_test_ token.",
    releaseGates: ["ntsb_test_ prefix enforcement", "Allowlisted Business Messaging endpoints", "Redacted request and response capture"],
  },
  messaging: {
    title: "Messaging scenarios",
    description: "Exercise the Business Messaging API with synthetic customers, conversations, and deterministic state transitions.",
    availability: "Isolated messaging sandbox",
    detail: "Simulate customer or business messages and transition delivery states across queued, sent, delivered, read, and failed.",
    releaseGates: ["Synthetic customer and conversation records", "Deterministic state transitions", "Correlated HMAC-signed webhook deliveries"],
  },
  scenarios: {
    title: "Scenarios",
    description: "Run deterministic Business Messaging scenarios and reset synthetic sandbox state cleanly.",
    availability: "Deterministic scenario runner",
    detail: "Execute reproducible delivery, read-receipt, failure, and customer-reply scenarios or reset synthetic state within your daily quota.",
    releaseGates: ["Deterministic server-side scenarios", "Quota-enforced reset behavior", "Webhook event correlation"],
  },
  events: {
    title: "Webhook events",
    description: "Inspect sandbox webhook endpoints, HMAC signatures, delivery attempts, and retries.",
    availability: "Isolated webhook delivery",
    detail: "Trigger synthetic test events and retry failed deliveries to verified HTTPS endpoints without touching production traffic.",
    releaseGates: ["Sandbox-only signing secrets", "SSRF-safe outbound delivery", "Delivery attempt inspection and manual retries"],
  },
  requests: {
    title: "Request log",
    description: "Inspect redacted requests made with ntsb_test_ credentials and track daily sandbox quotas.",
    availability: "Gateway request log",
    detail: "Review HTTP method, path, status, latency, request ID, and daily quota consumption for the selected application.",
    releaseGates: ["Authorization header redaction", "Request ID correlation", "Daily request, webhook, and reset quota telemetry"],
  },
  docs: {
    title: "Sandbox guide",
    description: "How isolated test credentials, synthetic tenants, deterministic scenarios, quotas, and webhooks work.",
    availability: "Sandbox isolation contract",
    detail: "Every Sandbox request requires an ntsb_test_ bearer token, operates only on synthetic conversations and customers, and enforces per-application daily quotas.",
    releaseGates: ["ntsb_test_ credentials only; production tokens rejected with 401/403", "Synthetic conversations, deterministic delivery transitions, and clean resets", "Signed HMAC-SHA256 webhook deliveries with SSRF protection and retries"],
  },
} as const;

export function isSandboxSectionKey(value: string): value is SandboxSectionKey {
  return Object.hasOwn(sandboxSectionDetails, value);
}

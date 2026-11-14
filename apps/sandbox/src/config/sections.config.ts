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
    description: "Create test-only applications and credentials that cannot access production data or services.",
    availability: "Sandbox application service is not connected",
    detail: "No test tenants or sandbox credentials are available from this deployment. Production credentials are never accepted here.",
    releaseGates: ["Dedicated sandbox credential issuer", "Synthetic tenant and identity store", "Server-side rejection of production credentials and resource IDs"],
  },
  explorer: {
    title: "API explorer",
    description: "Make scoped requests against the isolated sandbox API and inspect its documented responses.",
    availability: "Sandbox API is not connected",
    detail: "The explorer is disabled until a separate sandbox API origin, test-credential issuer, and isolated data plane are available.",
    releaseGates: ["Published, versioned request schema", "Environment-bound test authentication and scope checks", "Redacted request/response capture with request IDs"],
  },
  messaging: {
    title: "Messaging scenarios",
    description: "Exercise the proposed Business Messaging API with isolated test businesses, synthetic customers, and correlated webhook events.",
    availability: "Business messaging sandbox is not connected",
    detail: "No sandbox credentials, test businesses, message fixture service, or webhook receiver are available. Nothing submitted here can send to a real Nantty customer.",
    releaseGates: ["Sandbox-only credentials and synthetic customer/conversation records", "Deterministic queued, sent, delivered, read, and failed transitions", "Signed test webhook events with replay and retry inspection", "Production credential and identifier rejection tests"],
  },
  scenarios: {
    title: "Scenarios",
    description: "Generate deterministic test conversations, message states, and webhook events in a synthetic environment.",
    availability: "Scenario runner is not connected",
    detail: "No test users, businesses, conversations, or scenario outcomes are seeded in this app. Results will come only from an isolated service, never client-side fixtures.",
    releaseGates: ["Deterministic server-side fixtures and scenario versions", "Isolated cleanup/reset behavior", "Event/request correlation and reproducible outcomes"],
  },
  events: {
    title: "Webhook events",
    description: "Inspect sandbox-only event payloads, signatures, and delivery attempts.",
    availability: "Sandbox webhook service is not connected",
    detail: "No webhook events or deliveries are available. This app does not call developer-provided endpoints until outbound-network safeguards and event signing are implemented.",
    releaseGates: ["Sandbox-only event source and signing keys", "SSRF-safe outbound delivery and endpoint verification", "Retry, replay, and dead-letter inspection"],
  },
  requests: {
    title: "Request log",
    description: "Inspect redacted requests made with sandbox credentials and correlate them by request ID.",
    availability: "Sandbox request logging is not connected",
    detail: "No API traffic is routed through this portal. It does not keep browser-side request histories or display fabricated entries.",
    releaseGates: ["Gateway-side request logging, not browser-local history", "Credential/body redaction and retention limits", "Request ID correlation with events and webhook deliveries"],
  },
  docs: {
    title: "Sandbox guide",
    description: "Learn how test credentials, synthetic tenants, quotas, and simulated events will work.",
    availability: "Sandbox API contract is not published",
    detail: "Sandbox routes and test scenarios remain internal design until the service contract and environment isolation tests are implemented.",
    releaseGates: ["Sandbox contract separated from production OpenAPI", "Security tests reject cross-environment credentials and identifiers", "Documentation examples generated from contract tests"],
  },
} as const;

export function isSandboxSectionKey(value: string): value is SandboxSectionKey {
  return Object.hasOwn(sandboxSectionDetails, value);
}

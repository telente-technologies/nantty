export const sandboxSections = [
  { href: "/test-apps", label: "Test applications", icon: "code" },
  { href: "/explorer", label: "API explorer", icon: "activity" },
  { href: "/scenarios", label: "Scenarios", icon: "play" },
  { href: "/events", label: "Webhook events", icon: "share" },
  { href: "/requests", label: "Request log", icon: "clock" },
  { href: "/docs", label: "Sandbox guide", icon: "help" },
] as const;

export type SandboxSectionKey = keyof typeof sandboxSectionDetails;

export const sandboxSectionDetails = {
  "test-apps": {
    title: "Test applications",
    description: "Create test-only applications and credentials that cannot access production data or services.",
    availability: "Sandbox application service is not connected",
    detail: "No test tenants or sandbox credentials are available from this deployment. Production credentials are never accepted here.",
  },
  explorer: {
    title: "API explorer",
    description: "Make scoped requests against the isolated sandbox API and inspect its documented responses.",
    availability: "Sandbox API is not connected",
    detail: "The explorer is disabled until a separate sandbox API origin, test-credential issuer, and isolated data plane are available.",
  },
  scenarios: {
    title: "Scenarios",
    description: "Generate deterministic test conversations, message states, and webhook events in a synthetic environment.",
    availability: "Scenario runner is not connected",
    detail: "No test users, businesses, conversations, or scenario outcomes are seeded in this app. Results will come only from an isolated service, never client-side fixtures.",
  },
  events: {
    title: "Webhook events",
    description: "Inspect sandbox-only event payloads, signatures, and delivery attempts.",
    availability: "Sandbox webhook service is not connected",
    detail: "No webhook events or deliveries are available. This app does not call developer-provided endpoints until outbound-network safeguards and event signing are implemented.",
  },
  requests: {
    title: "Request log",
    description: "Inspect redacted requests made with sandbox credentials and correlate them by request ID.",
    availability: "Sandbox request logging is not connected",
    detail: "No API traffic is routed through this portal. It does not keep browser-side request histories or display fabricated entries.",
  },
  docs: {
    title: "Sandbox guide",
    description: "Learn how test credentials, synthetic tenants, quotas, and simulated events will work.",
    availability: "Sandbox API contract is not published",
    detail: "Sandbox routes and test scenarios remain internal design until the service contract and environment isolation tests are implemented.",
  },
} as const;

export function isSandboxSectionKey(value: string): value is SandboxSectionKey {
  return Object.hasOwn(sandboxSectionDetails, value);
}

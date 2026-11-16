export const developerNavigationGroups = [
  {
    label: "Workspace",
    items: [
      { href: "/organization", label: "Organization", icon: "organization" },
    ],
  },
  {
    label: "Build",
    items: [
      { href: "/applications", label: "Applications", icon: "briefcase" },
      { href: "/credentials", label: "API credentials", icon: "key" },
      { href: "/docs", label: "API documentation", icon: "book" },
      { href: "/messaging", label: "Business messaging", icon: "messaging" },
    ],
  },
  {
    label: "Operate",
    items: [
      { href: "/webhooks", label: "Webhooks", icon: "webhook" },
      { href: "/requests", label: "Request logs", icon: "requests" },
      { href: "/usage", label: "Usage and billing", icon: "usage" },
    ],
  },
] as const;

type DeveloperNavigationSection = (typeof developerNavigationGroups)[number]["items"][number];
export const developerSections: DeveloperNavigationSection[] = developerNavigationGroups.reduce<DeveloperNavigationSection[]>((sections, group) => {
  sections.push(...group.items);
  return sections;
}, []);

export type DeveloperSectionPath = (typeof developerSections)[number]["href"];

export const developerSectionDetails = {
  applications: {
    title: "Applications",
    description: "Register and manage Nantty integrations, environments, scopes, business grants, and production review.",
    availability: "Application registration is connected; runtime access is not",
    detail: "Draft application records are stored by Identity and scoped to an organization. Requested permissions remain requests only; credential issuance, grants, production review, and API traffic are not available.",
    releaseGates: ["Persisted per-application member grants", "Separate test and production credentials with rotation and revocation", "Reviewed scope approval, business authorization, and public API enforcement"],
  },
  credentials: {
    title: "API credentials",
    description: "Manage sandbox credentials for authorized applications. Production credentials are not available here.",
    availability: "Sandbox credential management",
    detail: "Credentials are issued only after Identity confirms your application-level credentials.manage capability. Secrets are returned once, stored as one-way digests, and can be expired, rotated, or revoked.",
    releaseGates: ["Production credential issuance remains disabled", "Authenticated Identity-to-Sandbox service configuration is required", "Production API approval, scope enforcement, and audited key custody remain separate release gates"],
  },
  webhooks: {
    title: "Webhooks",
    description: "Configure authorized event subscriptions and inspect signed delivery attempts.",
    availability: "Sandbox webhook management",
    detail: "Sandbox endpoints use server-side HTTPS and public-address checks, one-time encrypted signing secrets, transactional delivery enqueueing, bounded retries, and redacted delivery logs. Production webhook delivery remains unavailable.",
    releaseGates: ["Identity-authenticated signed-in portal workflow against deployed services", "Endpoint ownership verification before any production delivery", "Production event contracts, quotas, retention, and deployment"],
    workspace: {
      columns: ["Endpoint", "Subscribed events", "Status", "Last delivery"],
      emptyTitle: "No webhook endpoints",
      emptyDescription: "No Sandbox webhook endpoints have been created for this application.",
    },
  },
  requests: {
    title: "API request logs",
    description: "Review request outcomes using application, environment, status, and time filters.",
    availability: "Request logs are unavailable",
    detail: "The public API is not accepting developer traffic, so there are no trustworthy request records to display. Sample or fabricated logs are intentionally omitted.",
    releaseGates: ["Gateway request correlation and durable records", "Secret and personal-data redaction", "Organization-scoped access and retention policy"],
    workspace: {
      columns: ["Request", "Method and endpoint", "Status", "Duration", "Time"],
      emptyTitle: "No request records",
      emptyDescription: "The public API is not accepting traffic, so there are no request logs to search or inspect.",
    },
  },
  usage: {
    title: "Usage and billing",
    description: "Review authoritative usage, quotas, plan entitlements, invoices, and spending controls.",
    availability: "Usage and billing are unavailable",
    detail: "No developer usage ledger, entitlement service, or developer billing integration is connected. Prices, quotas, and balances will not be hardcoded into the portal.",
    releaseGates: ["Authoritative usage ledger and quota enforcement", "Server-owned plan entitlements and pricing", "Invoices, spend controls, and auditable adjustments"],
    workspace: {
      columns: ["Period", "Plan", "Usage", "Invoice", "Status"],
      emptyTitle: "Usage and billing are not available",
      emptyDescription: "No quotas, usage balances, invoices, or prices are published by this preview.",
    },
  },
  docs: {
    title: "Developer documentation",
    description: "The versioned API contract must document authentication, scopes, consent, messages, webhook signatures, quotas, and stable errors.",
    availability: "Public API documentation is not published",
    detail: "The candidate endpoint list in internal architecture documents is not an implemented public contract. This portal will not present planned routes as callable APIs.",
    releaseGates: ["Approved OpenAPI schemas and compatibility policy", "Examples generated from the tested public contract", "Negative authorization and environment-isolation tests"],
  },
  messaging: {
    title: "Business messaging API",
    description: "Review the proposed conversation, message, consent, and webhook contract for authorized business integrations.",
    availability: "Business messaging API is not accepting requests",
    detail: "The existing internal conversation APIs are not a public business API. Public credentials, business-scoped authorization, consent enforcement, idempotency, and durable delivery contracts are not connected here.",
    releaseGates: ["Public OpenAPI contract and versioned error envelope", "Business-bound credentials, least-privilege scopes, and tenant isolation", "Customer-initiated/consented messaging eligibility and human handover", "Durable idempotency, lifecycle states, signed webhooks, and audit coverage"],
  },
} as const;

export type DeveloperSectionKey = keyof typeof developerSectionDetails;

export interface DeveloperSectionContent {
  readonly title: string;
  readonly description: string;
  readonly availability: string;
  readonly detail: string;
  readonly releaseGates: readonly string[];
  readonly workspace?: {
    readonly columns: readonly string[];
    readonly emptyTitle: string;
    readonly emptyDescription: string;
  };
}

export function isDeveloperSectionKey(value: string): value is DeveloperSectionKey {
  return Object.hasOwn(developerSectionDetails, value);
}

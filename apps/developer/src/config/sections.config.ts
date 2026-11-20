export const developerNavigationGroups = [
  {
    label: "Workspace",
    items: [
      { href: "/onboarding", label: "Onboarding", icon: "activity" },
      { href: "/organization", label: "Team & roles", icon: "organization" },
      { href: "/businesses", label: "Connected businesses", icon: "briefcase" },
    ],
  },
  {
    label: "Build",
    items: [
      { href: "/applications", label: "Applications", icon: "briefcase" },
      { href: "/products", label: "API products", icon: "book" },
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
      { href: "/usage", label: "Usage & quotas", icon: "usage" },
      { href: "/billing", label: "Billing & plans", icon: "usage" },
      { href: "/audit-logs", label: "Audit logs", icon: "requests" },
      { href: "/sandbox", label: "Sandbox console", icon: "webhook" },
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
    availability: "Organization-scoped application registry",
    detail: "Applications are owned by your Nantty developer organization. New applications start in Sandbox; review does not currently enable Production Business Messaging.",
    releaseGates: ["Persisted per-application member grants", "Separate ntsb_test_ and ntlive_ credentials with rotation and revocation", "Reviewed production approval before live business traffic"],
  },
  credentials: {
    title: "API credentials",
    description: "Manage Sandbox (ntsb_test_) and approval-gated Production (ntlive_) API credentials.",
    availability: "Environment-isolated credential management",
    detail: "Switch between Sandbox and Production in the header. Secrets are shown once on creation or rotation and stored as SHA-256 digests. Rotation replaces the active key atomically; the old key stops working immediately.",
    releaseGates: ["Production ntlive_ issuance and rotation require an approved application", "Sandbox ntsb_test_ credentials are rejected on production routes", "Rotation is recorded in the organization audit log"],
  },
  webhooks: {
    title: "Webhooks",
    description: "Configure HTTPS event endpoints, verify ownership challenges, rotate signing secrets, and inspect deliveries.",
    availability: "Signed HMAC-SHA256 webhooks",
    detail: "Both Sandbox and Production enforce HTTPS, public-IP SSRF checks, AES-GCM secret custody, and Nantty-Signature HMAC verification. Production endpoints require challenge verification (/verify).",
    releaseGates: ["DNS + connect-time SSRF validation", "Endpoint ownership challenge before production delivery", "Bounded retry backoff with dead-letter visibility"],
    workspace: {
      columns: ["Endpoint", "Subscribed events", "Status", "Last delivery"],
      emptyTitle: "No webhook endpoints",
      emptyDescription: "No webhook endpoints have been created for this application in the selected environment.",
    },
  },
  requests: {
    title: "API request logs",
    description: "Review redacted Sandbox and approval-gated production API request outcomes by application, method, and status.",
    availability: "Sandbox & production request logs",
    detail: "Sandbox request logs are gated by request_logs.read; approved applications also expose production request logs via the production control plane.",
    releaseGates: ["Gateway request correlation and durable production records", "Secret and personal-data redaction", "Organization-scoped access and retention policy"],
  },
  usage: {
    title: "Usage & quotas",
    description: "Review Sandbox quotas and organization production usage tiers.",
    availability: "Sandbox & production metering",
    detail: "Monthly Sandbox message quotas and organization production tier quotas (sandbox, starter, growth, enterprise) are enforced server-side.",
    releaseGates: ["Separate Sandbox vs Production allowances", "Atomic server-side quota enforcement", "Upgrade paths via Billing & plans"],
  },
  docs: {
    title: "Developer documentation",
    description: "OpenAPI 3.1 contract, authentication, scopes, consent, messages, webhook signatures, quotas, and error codes.",
    availability: "OpenAPI 3.1 documentation live",
    detail: "Browse the public documentation hub for quickstarts, PKCE SSO, Business Messaging endpoints, webhook verification, and error reference.",
    releaseGates: ["OpenAPI 3.1 schema synced with mounted routes", "Copyable cURL and HMAC verification snippets", "Explicit distinction between Sandbox and Production endpoints"],
  },
  messaging: {
    title: "Business messaging API",
    description: "Review conversation, message, consent, and webhook contracts for Sandbox and Production integrations.",
    availability: "Sandbox active · Production read-only",
    detail: "Sandbox accepts synthetic customer conversations via ntsb_test_ tokens. Production supports consent-scoped conversation listing; message sending remains unavailable until secure dispatch is integrated.",
    releaseGates: ["Application review & approval for production credentials", "Explicit scopes: messages:send and conversations:read", "Organization monthly quota enforcement"],
  },
  onboarding: {
    title: "Developer onboarding",
    description: "Set up your organization, register your first application, and issue a Sandbox credential.",
    availability: "Guided onboarding",
    detail: "Resume from any completed step without creating duplicate organizations or applications.",
    releaseGates: ["Nantty SSO account sign-in", "Organization creation", "Application registration & Sandbox quickstart"],
  },
  products: {
    title: "API products",
    description: "Inspect available and planned Nantty platform APIs, required scopes, and approval rules.",
    availability: "Sandbox available · Production read-only",
    detail: "Synthetic Business Messaging is available in Sandbox. Production currently supports consent-scoped conversation reads but not message sending; future Commerce, Social, Identity, Trust, and Logistics APIs remain staged without fake endpoints.",
    releaseGates: ["Explicit environment & scope isolation per product", "Independent approval and quota policies"],
  },
  businesses: {
    title: "Connected businesses",
    description: "Inspect per-application team grants and business authorization boundaries.",
    availability: "Member & application capability grants",
    detail: "Manage which organization members and business authorizations can operate each application.",
    releaseGates: ["Least-privilege per-app grants", "Independent business-owner consent before live business access"],
  },
  billing: {
    title: "Billing & plans",
    description: "Manage organization subscription tiers, monthly API quotas, and plan upgrades.",
    availability: "Tier & quota management",
    detail: "View current monthly quota usage and switch between Sandbox, Starter, Growth, and Enterprise organization plans.",
    releaseGates: ["Atomic monthly quota enforcement", "Role-gated billing updates"],
  },
  "audit-logs": {
    title: "Audit logs",
    description: "Inspect immutable organization security, membership, credential, and application events.",
    availability: "Organization audit trail",
    detail: "Every organization mutation, role change, invitation, and application action is recorded with actor, role, and timestamp.",
    releaseGates: ["Tamper-evident append-only audit rows", "Scoped to organization members"],
  },
  sandbox: {
    title: "Sandbox console",
    description: "Launch isolated synthetic businesses, customers, conversation simulators, and scenario runs.",
    availability: "Isolated Sandbox control plane",
    detail: "Sandbox uses separate data stores and ntsb_test_ credentials so testing never touches real Nantty users or production quotas.",
    releaseGates: ["Separate Sandbox portal and API host", "Deterministic scenarios & webhook simulator"],
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

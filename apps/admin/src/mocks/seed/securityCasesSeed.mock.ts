import { isoMinutesAgo } from "@/mocks/seed/trustTime.mock";
import type { SecurityCaseDecision, SecurityCaseSeverity, SecurityCaseStatus, SecurityCaseTrigger, SecurityTimelineEntry } from "@/types/securityCases.type";

export interface MockSecurityCaseRecord {
  readonly id: string;
  readonly userId: string;
  readonly trigger: SecurityCaseTrigger;
  status: SecurityCaseStatus;
  readonly severity: SecurityCaseSeverity;
  readonly autoSuspended: boolean;
  readonly openedAt: string;
  readonly botScore: number;
  readonly botReasons: readonly string[];
  readonly timeline: readonly SecurityTimelineEntry[];
  decision: SecurityCaseDecision | null;
  decidedAt: string | null;
}

let sequence = 0;
const entry = (kind: SecurityTimelineEntry["kind"], minutesAgo: number, detail: Record<string, unknown>, deviceId = "ios-7f3a9c", ipPrefix = "102.89.34.0/24", source = "gateway"): SecurityTimelineEntry => {
  sequence += 1;
  return { id: `sev_${String(sequence).padStart(4, "0")}`, kind, at: isoMinutesAgo(minutesAgo), deviceId, ipPrefix, source, detail };
};

const probe = (minutesAgo: number, kind: string, routeTemplate: string, resourceType: string, windowCount: number, threshold: number) =>
  entry("access_violation", minutesAgo, { kind, routeTemplate, resourceType, windowCount, windowSeconds: 600, distinctResources: windowCount, threshold });

export function buildDemoSecurityCases(): MockSecurityCaseRecord[] {
  return [
    {
      id: "0192f7a0-1111-7000-8000-000000000001", userId: "usr_0018", trigger: "access_probing", status: "open", severity: "high", autoSuspended: true, openedAt: isoMinutesAgo(600), botScore: 0, botReasons: [], decision: null, decidedAt: null,
      timeline: [
        entry("auto_suspended", 20, { durationDays: 7, reason: "Security: repeated unauthorised access attempts" }, "", "", "go-trust"),
        entry("challenge_failed", 22, { provider: "turnstile", errorCodes: ["invalid-input-response"] }, "ios-7f3a9c", "102.89.34.0/24", "turnstile"),
        entry("challenge_failed", 30, { provider: "turnstile", errorCodes: ["timeout-or-duplicate"] }, "ios-7f3a9c", "102.89.34.0/24", "turnstile"),
        probe(80, "idEnumeration", "/api/v1/orders/:id", "order", 31, 12),
        entry("challenge_required", 300, { reason: "access_probing", violationKind: "privateNotFound" }, "ios-7f3a9c", "102.89.34.0/24", "go-trust"),
        probe(300, "privateNotFound", "/api/v1/orders/:id", "order", 17, 15),
        probe(590, "adminRoute", "/api/v1/admin/users", "admin", 3, 3),
        entry("case_opened", 600, { trigger: "access_probing" }, "", "", "go-trust"),
      ],
    },
    {
      id: "0192f7a0-1111-7000-8000-000000000002", userId: "usr_0021", trigger: "suspected_bot", status: "open", severity: "medium", autoSuspended: false, openedAt: isoMinutesAgo(140), botScore: 0.91, botReasons: ["robotic_request_cadence", "follow_burst", "headless_client"], decision: null, decidedAt: null,
      timeline: [
        entry("challenge_passed", 15, { provider: "turnstile", suspectedBot: true }, "web-c19d02", "41.58.112.0/24", "turnstile"),
        entry("bot_marked", 140, { reasons: ["behaviour_score", "headless_client"], score: 0.91 }, "", "", "go-trust"),
        entry("client_signals", 141, { platform: "web", headlessSignals: ["webdriver"], attestationVerdict: "" }, "web-c19d02", "", "client"),
        entry("bot_score_recorded", 142, { score: 0.91, reasonCodes: ["robotic_request_cadence", "follow_burst", "headless_client"], modelVersion: "bot_rules:v1" }, "", "", "intelligence"),
      ],
    },
    {
      id: "0192f7a0-1111-7000-8000-000000000003", userId: "usr_0027", trigger: "access_probing", status: "cleared", severity: "low", autoSuspended: false, openedAt: isoMinutesAgo(5 * 1440), botScore: 0, botReasons: [], decidedAt: isoMinutesAgo(4 * 1440),
      decision: { outcome: "cleared", reason: "Shared order links from a group chat; no pattern after the challenge.", decidedById: "adm_0002", decidedByName: "Tolu Adeyemi", decidedAt: isoMinutesAgo(4 * 1440), stepUp: true },
      timeline: [probe(5 * 1440, "privateNotFound", "/api/v1/orders/:id", "order", 15, 15), entry("challenge_passed", 5 * 1440 - 3, { provider: "turnstile" }, "android-55e0b1", "105.112.20.0/24", "turnstile")],
    },
  ];
}

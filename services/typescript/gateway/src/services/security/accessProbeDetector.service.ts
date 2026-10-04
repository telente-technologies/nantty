import { randomUUID } from "node:crypto";

import type { VerifiedPrincipal } from "../accessTokenVerifier.service.js";
import type { AccessViolationKind, ProbeSignal } from "./accessProbeClassifier.service.js";
import { truncateIpToPrefix } from "./accessProbeClassifier.service.js";
import type { SecurityStore } from "./securityStore.service.js";
import type { TrustSecurityClient } from "./securitySignalSink.service.js";

export interface ProbeThreshold {
  readonly count: number;
  readonly windowSeconds: number;
}

export type ProbeThresholds = Readonly<Record<AccessViolationKind, ProbeThreshold>>;

export const defaultProbeThresholds: ProbeThresholds = {
  forbidden: { count: 10, windowSeconds: 600 },
  privateNotFound: { count: 15, windowSeconds: 600 },
  idEnumeration: { count: 12, windowSeconds: 300 },
  internalPath: { count: 3, windowSeconds: 3600 },
  tamperedToken: { count: 5, windowSeconds: 600 },
  idempotencyMismatch: { count: 3, windowSeconds: 3600 },
  adminRoute: { count: 3, windowSeconds: 3600 },
};

export const violationReportCooldownSeconds = 600;

export interface ProbeObservation {
  readonly signal: ProbeSignal;
  readonly principal: VerifiedPrincipal | undefined;
  readonly deviceId: string | undefined;
  readonly clientIp: string | undefined;
  readonly requestId: string;
}

export class AccessProbeDetector {
  public constructor(
    private readonly store: SecurityStore,
    private readonly trust: TrustSecurityClient | undefined,
    private readonly thresholds: ProbeThresholds = defaultProbeThresholds,
    private readonly onFailure: (error: unknown) => void = () => undefined,
  ) {}

  public async observe(observation: ProbeObservation): Promise<readonly AccessViolationKind[]> {
    const subjects = this.subjectsFor(observation);
    const crossed: AccessViolationKind[] = [];
    const { signal } = observation;
    const counted = await this.countAcrossSubjects(subjects, signal.kind, observation.requestId);
    if (counted.count >= this.thresholds[signal.kind].count) crossed.push(signal.kind);
    let distinct = 0;
    if (signal.resourceId !== undefined && (signal.kind === "privateNotFound" || signal.kind === "forbidden")) {
      const distinctCount = await this.countAcrossSubjects(subjects, "idEnumeration", `${signal.resourceType}:${signal.resourceId}`);
      distinct = distinctCount.count;
      if (distinct >= this.thresholds.idEnumeration.count) crossed.push("idEnumeration");
    }
    const reported: AccessViolationKind[] = [];
    for (const kind of crossed) {
      const windowCount = kind === "idEnumeration" ? distinct : counted.count;
      if (await this.report(observation, kind, counted.subject, windowCount, distinct)) reported.push(kind);
    }
    return reported;
  }

  private subjectsFor(observation: ProbeObservation): string[] {
    const subjects: string[] = [];
    if (observation.principal !== undefined) subjects.push(`a:${observation.principal.accountId}`);
    if (observation.deviceId !== undefined && observation.deviceId !== "") subjects.push(`d:${observation.deviceId.slice(0, 128)}`);
    if (subjects.length === 0) subjects.push(`i:${observation.clientIp ?? "unknown"}`);
    return subjects;
  }

  private async countAcrossSubjects(subjects: readonly string[], kind: AccessViolationKind, member: string): Promise<{ count: number; subject: string }> {
    let best = { count: 0, subject: subjects[0] ?? "unknown" };
    for (const subject of subjects) {
      const count = await this.store.recordInWindow(`sec:probe:${kind}:${subject}`, member, this.thresholds[kind].windowSeconds);
      if (count > best.count) best = { count, subject };
    }
    return best;
  }

  private async report(observation: ProbeObservation, kind: AccessViolationKind, subject: string, windowCount: number, distinct: number): Promise<boolean> {
    if (!(await this.store.claimOnce(`sec:reported:${kind}:${subject}`, violationReportCooldownSeconds))) return false;
    if (this.trust === undefined) return true;
    try {
      await this.trust.reportAccessViolation({
        violationId: randomUUID(), accountId: observation.principal?.accountId ?? "", sessionId: observation.principal?.sessionId ?? "",
        deviceId: (observation.deviceId ?? "").slice(0, 128), ipPrefix: truncateIpToPrefix(observation.clientIp), kind,
        routeTemplate: observation.signal.routeTemplate, resourceType: observation.signal.resourceType, windowCount, windowSeconds: this.thresholds[kind].windowSeconds,
        distinctResources: distinct, threshold: this.thresholds[kind].count, source: "gateway", detectedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.onFailure(error);
    }
    return true;
  }
}

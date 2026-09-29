import type { EventBus, EventDefinition } from "@zudojs/events";

import { invalidState, notFound, unprocessable } from "../../../errors/domain.error.js";
import { NotificationRequestedEvent } from "../../../events/notificationRequested.event.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import type { ProfileType, VerificationStatus, VerificationTier } from "../../../interfaces/verificationBadge.interface.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import type { FieldCipher } from "../../../utils/crypto.util.js";
import {
  VerificationApplicationSubmittedEvent,
  VerificationApprovedEvent,
  VerificationRejectedEvent,
  VerificationRevokedEvent,
  VerificationSuspendedEvent,
  VerificationTierChangedEvent,
  type VerificationLifecyclePayload,
} from "../events/verificationLifecycle.event.js";
import type { ResolvedProfile, VerificationDetails, VerificationFilter, VerificationPatch, VerificationRecord } from "../models/verifications.model.js";
import {
  canVerificationTransition,
  findColorForProfileType,
  findVerificationTypeForProfileType,
  isBadgeVisible,
  isTierValidForProfileType,
} from "../policies/verification.policy.js";
import type { VerificationsRepository } from "../repositories/verifications.repository.js";
import { STORE_PROFILE_VIEWERS, type ProfileResolver } from "./profileResolver.service.js";
import { encryptVerificationDetails, type VerificationDetailsInput } from "./verificationDetails.service.js";

export interface VerificationsDependencies {
  readonly verifications: VerificationsRepository;
  readonly profiles: ProfileResolver;
  readonly cipher: FieldCipher;
  readonly audit: AuditRecorder;
  readonly events: EventBus;
  readonly clock: Clock;
  readonly findSubscribedTier: (profileId: string) => Promise<VerificationTier | null>;
}

export interface VerificationApplication {
  readonly profileType: ProfileType;
  readonly tier?: VerificationTier | undefined;
  readonly storeId?: string | undefined;
  readonly details?: VerificationDetailsInput | undefined;
}

type AdminDecision = "approve" | "reject" | "suspend" | "revoke";

const DECISIONS: Readonly<Record<AdminDecision, { readonly to: VerificationStatus; readonly event: EventDefinition<string, VerificationLifecyclePayload>; readonly reasonRequired: boolean; readonly action: string }>> = {
  approve: { to: "VERIFIED", event: VerificationApprovedEvent, reasonRequired: false, action: "verifications.approved" },
  reject: { to: "UNVERIFIED", event: VerificationRejectedEvent, reasonRequired: true, action: "verifications.rejected" },
  suspend: { to: "SUSPENDED", event: VerificationSuspendedEvent, reasonRequired: true, action: "verifications.suspended" },
  revoke: { to: "REVOKED", event: VerificationRevokedEvent, reasonRequired: true, action: "verifications.revoked" },
};

export class VerificationsService {
  public constructor(public readonly dependencies: VerificationsDependencies) {}

  public async applyForVerification(principal: Principal, application: VerificationApplication): Promise<VerificationRecord> {
    const profile = await this.dependencies.profiles.resolveProfileForPrincipal(principal, application.profileType, application.storeId);
    const tier = await this.chooseTierForApplication(profile, application.tier);
    const details = application.details === undefined ? null : await encryptVerificationDetails(this.dependencies.cipher, application.details);
    return this.submitApplication(profile, tier, details, principal.userId);
  }

  public async submitApplication(profile: ResolvedProfile, tier: VerificationTier | null, details: VerificationDetails | null, actorId: string): Promise<VerificationRecord> {
    const { verifications, clock } = this.dependencies;
    const now = clock.now();
    const existing = await verifications.findByProfileId(profile.profileId);
    if (existing?.status === "PENDING") throw invalidState("verification application is already pending review");
    if (existing?.status === "VERIFIED") throw invalidState("profile is already verified");
    const record = existing === undefined
      ? await verifications.create({
          ...profile,
          verificationType: findVerificationTypeForProfileType(profile.profileType),
          color: findColorForProfileType(profile.profileType),
          status: "PENDING",
          tier,
          badgeVisible: false,
          applicationSubmittedAt: now,
          reviewedAt: null,
          reviewedById: null,
          reason: null,
          details,
        })
      : await verifications.update(profile.profileId, { status: "PENDING", tier, badgeVisible: false, applicationSubmittedAt: now, reviewedAt: null, reviewedById: null, reason: null, details }, now);
    await this.recordChange(actorId, "verifications.applied", record, existing?.status ?? "UNVERIFIED", null);
    await publishEvent(this.dependencies.events, VerificationApplicationSubmittedEvent, this.describe(record));
    return record;
  }

  public async reviewVerification(adminId: string, profileId: string, decision: AdminDecision, reason: string | undefined): Promise<VerificationRecord> {
    const { verifications, clock } = this.dependencies;
    const rule = DECISIONS[decision];
    const existing = await this.findByProfileIdOrThrow(profileId);
    if ((decision === "approve" || decision === "reject") && existing.status !== "PENDING") throw invalidState("verification is not pending review");
    if (!canVerificationTransition(existing.status, rule.to)) throw invalidState("verification state transition is not allowed");
    const trimmedReason = reason?.trim() ?? "";
    if (rule.reasonRequired && trimmedReason === "") throw unprocessable("a reason is required for this action");
    const now = clock.now();
    const patch: VerificationPatch = {
      status: rule.to,
      badgeVisible: rule.to === "VERIFIED" ? isBadgeVisible("VERIFIED", existing.tier) : false,
      reason: trimmedReason === "" ? null : trimmedReason,
      ...(decision === "approve" || decision === "reject" ? { reviewedAt: now, reviewedById: adminId } : {}),
    };
    const updated = await verifications.update(profileId, patch, now);
    await this.recordChange(adminId, rule.action, updated, existing.status, patch.reason ?? null);
    await publishEvent(this.dependencies.events, rule.event, this.describe(updated));
    await publishEvent(this.dependencies.events, NotificationRequestedEvent, {
      userId: updated.ownerUserId,
      category: "promotions",
      title: decision === "approve" ? "Verification approved" : "Verification update",
      body: decision === "approve" ? "Your profile is now verified." : `Your verification is now ${rule.to.toLowerCase()}.${patch.reason === null ? "" : ` Reason: ${patch.reason}`}`,
      data: { profileId },
    });
    return updated;
  }

  public async syncTierFromSubscription(profileId: string, tier: VerificationTier): Promise<void> {
    const existing = await this.dependencies.verifications.findByProfileId(profileId);
    if (existing === undefined || !isTierValidForProfileType(existing.profileType, tier)) return;
    const updated = await this.dependencies.verifications.update(profileId, { tier, badgeVisible: isBadgeVisible(existing.status, tier) }, this.dependencies.clock.now());
    await this.recordChange(null, "verifications.tier_synced", updated, existing.status, null);
    await publishEvent(this.dependencies.events, VerificationTierChangedEvent, this.describe(updated));
  }

  public async hideBadgeForSubscription(profileId: string, reason: string): Promise<void> {
    const existing = await this.dependencies.verifications.findByProfileId(profileId);
    if (existing === undefined || !existing.badgeVisible) return;
    const updated = await this.dependencies.verifications.update(profileId, { badgeVisible: false }, this.dependencies.clock.now());
    await this.recordChange(null, "verifications.badge_hidden", updated, existing.status, reason);
  }

  public async findByProfileIdOrThrow(profileId: string): Promise<VerificationRecord> {
    const record = await this.dependencies.verifications.findByProfileId(profileId);
    if (record === undefined) throw notFound("Verification");
    return record;
  }

  public async findVerificationForPrincipal(principal: Principal, profileType: ProfileType, storeId: string | undefined): Promise<VerificationRecord> {
    const { profiles } = this.dependencies;
    const profile = profileType === "PERSONAL" || profileType === "GOVERNMENT"
      ? await profiles.resolveProfileForPrincipal(principal, profileType, undefined)
      : await profiles.resolveStoreProfile(principal, storeId, STORE_PROFILE_VIEWERS, profileType);
    return this.findByProfileIdOrThrow(profile.profileId);
  }

  public listVerifications(filter: VerificationFilter, page: PageRequest): Promise<Page<VerificationRecord>> {
    return this.dependencies.verifications.list(filter, page);
  }

  private async chooseTierForApplication(profile: ResolvedProfile, requestedTier: VerificationTier | undefined): Promise<VerificationTier | null> {
    if (profile.profileType === "GOVERNMENT") {
      if (requestedTier !== undefined && requestedTier !== "OFFICIAL") throw unprocessable("tier is not valid for this profile type");
      return "OFFICIAL";
    }
    if (requestedTier !== undefined && !isTierValidForProfileType(profile.profileType, requestedTier)) throw unprocessable("tier is not valid for this profile type");
    const subscribedTier = await this.dependencies.findSubscribedTier(profile.profileId);
    if (requestedTier !== undefined && requestedTier !== subscribedTier) throw unprocessable(`Subscribe to the ${requestedTier} plan before applying with it.`);
    return subscribedTier;
  }

  private describe(record: VerificationRecord): VerificationLifecyclePayload {
    return { profileId: record.profileId, profileType: record.profileType, status: record.status, tier: record.tier, reason: record.reason };
  }

  private recordChange(actorId: string | null, action: string, record: VerificationRecord, previousStatus: VerificationStatus, reason: string | null): Promise<void> {
    return this.dependencies.audit.record({
      actorId,
      action,
      entityType: "profile_verification",
      entityId: record.profileId,
      metadata: { profileType: record.profileType, previousStatus, newStatus: record.status, tier: record.tier, badgeVisible: record.badgeVisible, reason },
    });
  }
}

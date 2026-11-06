import type { IdentityDirectory } from "../../../../interfaces/identityDirectory.interface.js";
import type { PreferenceRepository } from "../../../../interfaces/repositories.interface.js";
import type { ReengagementRepository } from "../../../../interfaces/reengagementRepository.interface.js";
import type { NotificationDispatcherService } from "../../../delivery/services/notificationDispatcher.service.js";
import type { NotificationsConfig } from "../../../../configs/notifications.config.js";
import { buildReengagementPush, isInLocalQuietHours, reengagementCapDays, reengagementInactiveDays } from "../../services/reengagementPolicy.service.js";

const dayMs = 24 * 60 * 60_000;

export class ProcessReengagementHandler {
  public constructor(private readonly deps: {
    readonly repository: ReengagementRepository;
    readonly identity: IdentityDirectory;
    readonly preferences: PreferenceRepository;
    readonly dispatcher: NotificationDispatcherService;
    readonly quietHours: NotificationsConfig["reengagement"];
    readonly now?: () => Date;
  }) {}

  public async execute(command: { readonly deliveryId: string }): Promise<void> {
    const now = (this.deps.now ?? (() => new Date()))();
    const item = await this.deps.repository.findWorkItem(command.deliveryId);
    if (item === null || item.status !== "pending") return;

    const inactiveBefore = new Date(now.getTime() - reengagementInactiveDays * dayMs);
    if (item.activity.lastActivityAt > inactiveBefore) return void await this.deps.repository.skipPending(item.id, "new_activity");
    const recipient = await this.deps.identity.getRecipient(item.accountId);
    if (recipient === null || recipient.status !== "active" || !recipient.marketingConsent || recipient.pushEnabled === false) {
      return void await this.deps.repository.skipPending(item.id, "marketing_consent_or_account_ineligible");
    }
    const marketingPush = (await this.deps.preferences.list(item.accountId)).find((preference) => preference.category === "marketing")?.push;
    if (marketingPush !== true) return void await this.deps.repository.skipPending(item.id, "marketing_push_preference_disabled");
    if (isInLocalQuietHours(item.activity.timeZone, now, { start: this.deps.quietHours.quietHoursStart, end: this.deps.quietHours.quietHoursEnd })) return;

    const claim = await this.deps.repository.claimDispatch({
      id: item.id,
      now,
      inactiveBefore,
      cooldownBefore: new Date(now.getTime() - reengagementCapDays * dayMs),
    });
    if (claim !== "claimed") return;

    try {
      const outcome = await this.deps.dispatcher.dispatch({
        eventId: `reengagement:${item.dedupeKey}`,
        recipientUserId: item.accountId,
        preferenceCategory: "marketing",
        push: buildReengagementPush(),
      });
      if (outcome.push === "sent") await this.deps.repository.finish(item.id, "sent");
      else if (outcome.push.startsWith("skipped:")) await this.deps.repository.finish(item.id, "skipped", outcome.push);
      else await this.deps.repository.finish(item.id, "failed", outcome.push);
    } catch {
      // The provider may have accepted the push before a transport error surfaced. Do not replay it.
      await this.deps.repository.finish(item.id, "failed", "provider_outcome_uncertain");
    }
  }
}

import { CommandHandler } from "@zudojs/cqrs";

import { invalidState, notFound } from "../../../../errors/domain.error.js";
import { NotificationRequestedEvent } from "../../../../events/notificationRequested.event.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import { CreatorStatusChangedEvent } from "../../events/creatorStatusChanged.event.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { CreatorProgramStatusView } from "../../services/creators.service.js";
import type { ChangeCreatorStandingCommand } from "./changeCreatorStanding.command.js";

export class ChangeCreatorStandingHandler extends CommandHandler<ChangeCreatorStandingCommand, CreatorProgramStatusView> {
  public readonly commandType = "creators.changeCreatorStanding" as const;

  public constructor(private readonly services: CreatorProgramServices) {
    super();
  }

  public async execute(command: ChangeCreatorStandingCommand): Promise<CreatorProgramStatusView> {
    const { program, audit, events, clock } = this.services.creators.dependencies;
    const profile = await program.findProfile(command.creatorId);
    if (profile === undefined) throw notFound("Creator");
    const suspending = command.action === "suspend";
    if (suspending === (profile.status === "suspended")) throw invalidState(suspending ? "This creator is already suspended." : "This creator is not suspended.");
    const now = clock.now();
    await program.saveProfile({ ...profile, status: suspending ? "suspended" : "approved", suspendedAt: suspending ? now : null, suspensionReason: suspending ? command.reason : null });
    if (suspending) await program.recordViolation({ userId: profile.userId, reason: command.reason ?? "Suspended by an administrator", recordedById: command.principal.userId, createdAt: now });
    await audit.record({
      actorId: command.principal.userId,
      action: suspending ? "creators.suspended" : "creators.reinstated",
      entityType: "creator",
      entityId: profile.userId,
      metadata: { previousStatus: profile.status, reason: command.reason },
    });
    await publishEvent(events, CreatorStatusChangedEvent, { userId: profile.userId, status: suspending ? "suspended" : "approved", actorId: command.principal.userId });
    await publishEvent(events, NotificationRequestedEvent, {
      userId: profile.userId,
      category: "promotions",
      title: suspending ? "Your creator account is suspended" : "Your creator account is active again",
      body: suspending ? (command.reason ?? "You cannot go live or earn until this is resolved.") : "You can go live and earn again.",
      data: { type: "creator_standing" },
    });
    return this.services.creators.findProgramStatus(profile.userId);
  }
}

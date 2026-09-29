import { CommandHandler } from "@zudojs/cqrs";

import { invalidState, notFound } from "../../../../errors/domain.error.js";
import { NotificationRequestedEvent } from "../../../../events/notificationRequested.event.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import type { CreatorApplicationDto } from "../../dtos/creators.dto.js";
import { CreatorStatusChangedEvent } from "../../events/creatorStatusChanged.event.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import { presentCreatorApplication } from "../../services/creators.service.js";
import type { ReviewCreatorApplicationCommand } from "./reviewCreatorApplication.command.js";

const DEFAULT_CREATOR_TIER = "standard";

export class ReviewCreatorApplicationHandler extends CommandHandler<ReviewCreatorApplicationCommand, CreatorApplicationDto> {
  public readonly commandType = "creators.reviewCreatorApplication" as const;

  public constructor(private readonly services: CreatorProgramServices) {
    super();
  }

  public async execute(command: ReviewCreatorApplicationCommand): Promise<CreatorApplicationDto> {
    const { program, audit, events, clock } = this.services.creators.dependencies;
    const application = await program.findApplication(command.applicationId);
    if (application === undefined) throw notFound("Creator application");
    const approved = command.input.decision === "approve";
    const reviewedAt = clock.now();
    const reviewed = await program.markApplicationReviewedIfPending(application.id, {
      status: approved ? "approved" : "rejected",
      reviewerId: command.principal.userId,
      reviewNote: command.input.note ?? null,
      reviewedAt,
    });
    if (!reviewed) throw invalidState("This application has already been reviewed.");
    if (approved) {
      await program.saveProfile({ userId: application.userId, status: "approved", tier: DEFAULT_CREATOR_TIER, approvedAt: reviewedAt, suspendedAt: null, suspensionReason: null });
    }
    await audit.record({
      actorId: command.principal.userId,
      action: approved ? "creators.application_approved" : "creators.application_rejected",
      entityType: "creator_application",
      entityId: application.id,
      metadata: { applicantId: application.userId, note: command.input.note ?? null },
    });
    await publishEvent(events, CreatorStatusChangedEvent, { userId: application.userId, status: approved ? "approved" : "rejected", actorId: command.principal.userId });
    await publishEvent(events, NotificationRequestedEvent, {
      userId: application.userId,
      category: "promotions",
      title: approved ? "Welcome to the Creator Program" : "Your creator application was not approved",
      body: approved ? "You can now go live, receive gifts and earn affiliate commissions." : (command.input.note ?? "You can apply again later."),
      data: { type: "creator_application", applicationId: application.id },
    });
    return presentCreatorApplication((await program.findApplication(application.id)) ?? application);
  }
}

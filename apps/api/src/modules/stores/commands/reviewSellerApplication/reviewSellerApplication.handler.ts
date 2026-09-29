import { CommandHandler } from "@zudojs/cqrs";

import { Role } from "../../../../constants/roles.constant.js";
import { invalidState, notFound } from "../../../../errors/domain.error.js";
import { NotificationRequestedEvent } from "../../../../events/notificationRequested.event.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import type { SellerApplicationDto } from "../../dtos/stores.dto.js";
import { SellerApplicationReviewedEvent } from "../../events/sellerApplicationReviewed.event.js";
import type { StoresService } from "../../services/stores.service.js";
import type { ReviewSellerApplicationCommand } from "./reviewSellerApplication.command.js";

export class ReviewSellerApplicationHandler extends CommandHandler<ReviewSellerApplicationCommand, SellerApplicationDto> {
  public readonly commandType = "stores.reviewSellerApplication" as const;

  public constructor(private readonly storesService: StoresService) {
    super();
  }

  public async execute(command: ReviewSellerApplicationCommand): Promise<SellerApplicationDto> {
    const { applications, userDirectory, audit, events } = this.storesService.dependencies;
    const application = await applications.findById(command.applicationId);
    if (application === undefined) throw notFound("Seller application");
    const approved = command.input.decision === "approve";
    const reviewed = await applications.markReviewedIfPending(application.id, {
      status: approved ? "approved" : "rejected",
      reviewerId: command.principal.userId,
      reviewNote: command.input.note ?? null,
      reviewedAt: new Date(),
    });
    if (!reviewed) throw invalidState("This application has already been reviewed.");
    let storeId: string | null = null;
    if (approved) {
      await userDirectory.grantRole(application.userId, Role.SELLER);
      const currency = await this.storesService.chooseStoreCurrencyForUser(application.userId);
      storeId = (await this.storesService.createStoreOwnedBy(application.userId, { name: application.storeName, description: application.description }, currency)).id;
    }
    await audit.record({
      actorId: command.principal.userId,
      action: approved ? "stores.seller_application_approved" : "stores.seller_application_rejected",
      entityType: "seller_application",
      entityId: application.id,
      metadata: { applicantId: application.userId, storeId, roleGranted: approved ? Role.SELLER : null },
    });
    await publishEvent(events, SellerApplicationReviewedEvent, { applicationId: application.id, userId: application.userId, decision: command.input.decision, storeId, onboarding: application.onboarding });
    await publishEvent(events, NotificationRequestedEvent, {
      userId: application.userId,
      category: "promotions",
      title: approved ? "Your store is approved" : "Your seller application was not approved",
      body: approved ? `${application.storeName} is ready. Sign in again to start selling.` : (command.input.note ?? "You can apply again with more details."),
      data: { applicationId: application.id, ...(storeId === null ? {} : { storeId }) },
    });
    const updated = await applications.findById(application.id);
    return this.storesService.convertApplicationWithDecryptedPhone(updated ?? application);
  }
}

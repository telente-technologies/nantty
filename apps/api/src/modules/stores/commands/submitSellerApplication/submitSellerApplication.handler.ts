import { CommandHandler } from "@zudojs/cqrs";

import { invalidState } from "../../../../errors/domain.error.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import { normalizePhoneNumber } from "../../../auth/services/contact.service.js";
import type { SellerApplicationDto } from "../../dtos/stores.dto.js";
import { SellerApplicationSubmittedEvent } from "../../events/sellerApplicationSubmitted.event.js";
import { prepareSellerOnboardingDetails } from "../../services/sellerOnboarding.service.js";
import type { StoresService } from "../../services/stores.service.js";
import type { SubmitSellerApplicationCommand } from "./submitSellerApplication.command.js";

export class SubmitSellerApplicationHandler extends CommandHandler<SubmitSellerApplicationCommand, SellerApplicationDto> {
  public readonly commandType = "stores.submitSellerApplication" as const;

  public constructor(private readonly storesService: StoresService) {
    super();
  }

  public async execute(command: SubmitSellerApplicationCommand): Promise<SellerApplicationDto> {
    const { applications, cipher, events } = this.storesService.dependencies;
    const userId = command.principal.userId;
    const previous = await applications.listForUser(userId);
    if (previous.some((application) => application.status === "pending")) {
      throw invalidState("You already have an application waiting for review.");
    }
    const application = await applications.create({
      userId,
      storeName: command.input.storeName.trim(),
      description: command.input.description ?? "",
      categoryId: command.input.categoryId ?? null,
      phoneEncrypted: await cipher.encryptText(normalizePhoneNumber(command.input.phone)),
      onboarding: await prepareSellerOnboardingDetails(this.storesService, userId, command.input),
    });
    await publishEvent(events, SellerApplicationSubmittedEvent, { applicationId: application.id, userId });
    return this.storesService.convertApplicationWithDecryptedPhone(application);
  }
}

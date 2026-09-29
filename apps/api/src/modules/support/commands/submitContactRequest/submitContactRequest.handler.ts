import { CommandHandler } from "@zudojs/cqrs";

import type { SupportService } from "../../services/support.service.js";
import type { SubmitContactRequestCommand } from "./submitContactRequest.command.js";

export interface ContactRequestReceipt {
  readonly id: string;
  readonly status: "received";
}

export class SubmitContactRequestHandler extends CommandHandler<SubmitContactRequestCommand, ContactRequestReceipt> {
  public readonly commandType = "support.submitContactRequest" as const;

  public constructor(private readonly supportService: SupportService) {
    super();
  }

  public async execute(command: SubmitContactRequestCommand): Promise<ContactRequestReceipt> {
    const { contactRequests, cipher, audit, clock } = this.supportService.dependencies;
    const { kind, name, subject, message } = command.input;
    const contactEmail = command.input.email.trim().toLowerCase();
    const request = await contactRequests.createContactRequest(
      {
        kind,
        name: name.trim(),
        emailCiphertext: await cipher.encryptText(contactEmail),
        subject: subject.trim(),
        message: message.trim(),
        requesterId: command.principal?.userId ?? null,
      },
      clock.now(),
    );
    await audit.record({ actorId: command.principal?.userId ?? null, action: `support.${kind}_request_received`, entityType: "support_contact_request", entityId: request.id });
    await this.supportService.notifySupportTeamSafely(subject.trim(), `From: ${name.trim()}\nRequest: ${request.id}\n\n${message.trim()}`, kind, contactEmail);
    return { id: request.id, status: "received" };
  }
}

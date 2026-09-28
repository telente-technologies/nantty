import { CommandHandler } from "@zudojs/cqrs";

import { publishEvent } from "../../../../loaders/events.loader.js";
import { normalizeEmailAddress } from "../../../auth/services/contact.service.js";
import { WaitlistJoinedEvent } from "../../events/waitlistJoined.event.js";
import type { WaitlistService } from "../../services/waitlist.service.js";
import type { JoinWaitlistCommand } from "./joinWaitlist.command.js";

export class JoinWaitlistHandler extends CommandHandler<JoinWaitlistCommand, void> {
  public readonly commandType = "waitlist.joinWaitlist" as const;

  public constructor(private readonly waitlistService: WaitlistService) {
    super();
  }

  public async execute(command: JoinWaitlistCommand): Promise<void> {
    const { entries, events, clock } = this.waitlistService.dependencies;
    const email = normalizeEmailAddress(command.input.email);
    const role = command.input.role ?? "buyer";
    const created = await entries.addEntryIfEmailIsNew(
      { email, name: command.input.name?.trim() ?? "", role, source: command.input.source ?? "landing" },
      clock.now(),
    );
    if (created) await publishEvent(events, WaitlistJoinedEvent, { email, role });
  }
}

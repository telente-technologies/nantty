import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetVoiceNoteQuery extends Query<"messages.getVoiceNote"> {
  public constructor(
    public readonly principal: Principal,
    public readonly conversationId: string,
    public readonly messageId: string,
  ) {
    super("messages.getVoiceNote");
  }
}

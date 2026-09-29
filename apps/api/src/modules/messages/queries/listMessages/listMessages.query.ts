import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListMessagesQuery extends Query<"messages.listMessages"> {
  public constructor(
    public readonly principal: Principal,
    public readonly conversationId: string,
    public readonly page: PageRequest,
    public readonly after: string | undefined,
  ) {
    super("messages.listMessages");
  }
}

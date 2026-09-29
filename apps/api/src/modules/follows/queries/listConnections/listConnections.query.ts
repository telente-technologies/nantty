import { Query } from "@zudojs/cqrs";

import type { ConnectionTab } from "../../services/connections.service.js";
import type { PageRequest } from "../../../../types/pagination.type.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListConnectionsQuery extends Query<"follows.listConnections"> {
  public constructor(
    public readonly principal: Principal,
    public readonly userId: string,
    public readonly tab: ConnectionTab,
    public readonly page: PageRequest,
  ) {
    super("follows.listConnections");
  }
}

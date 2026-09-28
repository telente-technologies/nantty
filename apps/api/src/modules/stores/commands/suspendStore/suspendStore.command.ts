import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class SuspendStoreCommand extends Command<"stores.suspendStore"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly status: "active" | "suspended",
    public readonly reason: string | undefined,
  ) {
    super("stores.suspendStore");
  }
}

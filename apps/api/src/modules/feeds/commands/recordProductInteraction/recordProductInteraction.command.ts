import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { ProductInteractionSignal } from "../../models/feeds.model.js";

export class RecordProductInteractionCommand extends Command<"feeds.recordProductInteraction"> {
  public constructor(
    public readonly principal: Principal,
    public readonly signal: ProductInteractionSignal,
    public readonly country: string | null,
  ) {
    super("feeds.recordProductInteraction");
  }
}

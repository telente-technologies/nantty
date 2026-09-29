import { Command } from "@zudojs/cqrs";

import type { NewBrandDealInput } from "../../services/brandDeals.service.js";

export class RecordBrandDealCommand extends Command<"creators.recordBrandDeal"> {
  public constructor(
    public readonly creatorId: string,
    public readonly input: NewBrandDealInput,
  ) {
    super("creators.recordBrandDeal");
  }
}

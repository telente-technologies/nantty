import { Command } from "@zudojs/cqrs";

export class RemoveBrandDealCommand extends Command<"creators.removeBrandDeal"> {
  public constructor(
    public readonly creatorId: string,
    public readonly dealId: string,
  ) {
    super("creators.removeBrandDeal");
  }
}

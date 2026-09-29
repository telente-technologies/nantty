import { Command } from "@zudojs/cqrs";

export class VerifyCoinPurchaseCommand extends Command<"coins.verifyCoinPurchase"> {
  public constructor(
    public readonly userId: string,
    public readonly reference: string,
  ) {
    super("coins.verifyCoinPurchase");
  }
}

import { Command } from "@zudojs/cqrs";

export class DeactivateCashbackPromoCommand extends Command<"loyalty.deactivateCashbackPromo"> {
  public constructor(
    public readonly adminId: string,
    public readonly promoId: string,
  ) {
    super("loyalty.deactivateCashbackPromo");
  }
}

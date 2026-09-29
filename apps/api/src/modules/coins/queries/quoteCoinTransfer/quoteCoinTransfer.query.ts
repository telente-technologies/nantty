import { Query } from "@zudojs/cqrs";

export class QuoteCoinTransferQuery extends Query<"coins.quoteCoinTransfer"> {
  public constructor(
    public readonly coins: number,
  ) {
    super("coins.quoteCoinTransfer");
  }
}

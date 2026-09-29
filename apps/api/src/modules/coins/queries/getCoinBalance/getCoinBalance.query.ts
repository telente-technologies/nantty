import { Query } from "@zudojs/cqrs";

export class GetCoinBalanceQuery extends Query<"coins.getCoinBalance"> {
  public constructor(
    public readonly userId: string,
  ) {
    super("coins.getCoinBalance");
  }
}

import { Query } from "@zudojs/cqrs";

export class ListCashbackPromosQuery extends Query<"loyalty.listCashbackPromos"> {
  public constructor() {
    super("loyalty.listCashbackPromos");
  }
}

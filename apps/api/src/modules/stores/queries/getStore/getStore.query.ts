import { Query } from "@zudojs/cqrs";

export class GetStoreQuery extends Query<"stores.getStore"> {
  public constructor(
    public readonly lookup: { readonly id: string } | { readonly slug: string },
  ) {
    super("stores.getStore");
  }
}

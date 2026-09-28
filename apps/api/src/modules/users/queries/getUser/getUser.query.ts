import { Query } from "@zudojs/cqrs";

export class GetUserQuery extends Query<"users.getUser"> {
  public constructor(
    public readonly lookup: { readonly id: string } | { readonly username: string },
  ) {
    super("users.getUser");
  }
}

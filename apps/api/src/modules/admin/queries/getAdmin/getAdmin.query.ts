import { Query } from "@zudojs/cqrs";

export class GetAdminQuery extends Query<"admin.getAdmin"> {
  public constructor(
    public readonly staffId: string,
  ) {
    super("admin.getAdmin");
  }
}

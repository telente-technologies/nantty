import { Query } from "@zudojs/cqrs";

export class GetStaffAccountQuery extends Query<"admin.getStaffAccount"> {
  public constructor(
    public readonly targetUserId: string,
  ) {
    super("admin.getStaffAccount");
  }
}

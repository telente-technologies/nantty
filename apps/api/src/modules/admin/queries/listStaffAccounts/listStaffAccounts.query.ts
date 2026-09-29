import { Query } from "@zudojs/cqrs";

export class ListStaffAccountsQuery extends Query<"admin.listStaffAccounts"> {
  public constructor() {
    super("admin.listStaffAccounts");
  }
}

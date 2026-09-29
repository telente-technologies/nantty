import { Query } from "@zudojs/cqrs";

export class GetAdminAuditEntryQuery extends Query<"admin.getAdminAuditEntry"> {
  public constructor(
    public readonly entryId: string,
  ) {
    super("admin.getAdminAuditEntry");
  }
}

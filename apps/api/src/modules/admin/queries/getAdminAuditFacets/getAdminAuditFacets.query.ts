import { Query } from "@zudojs/cqrs";

export class GetAdminAuditFacetsQuery extends Query<"admin.getAdminAuditFacets"> {
  public constructor() {
    super("admin.getAdminAuditFacets");
  }
}

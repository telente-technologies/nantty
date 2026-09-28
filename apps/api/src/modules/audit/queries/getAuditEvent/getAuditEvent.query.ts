import { Query } from "@zudojs/cqrs";

export class GetAuditEventQuery extends Query<"audit.getAuditEvent"> {
  public constructor(
    public readonly id: string,
  ) {
    super("audit.getAuditEvent");
  }
}

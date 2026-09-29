import { Query } from "@zudojs/cqrs";

export class PreviewAdminInvitationQuery extends Query<"admin.previewAdminInvitation"> {
  public constructor(
    public readonly token: string,
  ) {
    super("admin.previewAdminInvitation");
  }
}

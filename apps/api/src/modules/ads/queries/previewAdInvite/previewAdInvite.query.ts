import { Query } from "@zudojs/cqrs";

export class PreviewAdInviteQuery extends Query<"ads.previewAdInvite"> {
  public constructor(
    public readonly token: string,
  ) {
    super("ads.previewAdInvite");
  }
}

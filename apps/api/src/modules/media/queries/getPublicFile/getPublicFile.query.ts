import { Query } from "@zudojs/cqrs";

export class GetPublicFileQuery extends Query<"media.getPublicFile"> {
  public constructor(
    public readonly storageKey: string,
  ) {
    super("media.getPublicFile");
  }
}

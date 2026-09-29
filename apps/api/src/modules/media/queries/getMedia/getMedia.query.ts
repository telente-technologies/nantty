import { Query } from "@zudojs/cqrs";

export class GetMediaQuery extends Query<"media.getMedia"> {
  public constructor(
    public readonly mediaId: string,
  ) {
    super("media.getMedia");
  }
}

import { Query } from "@zudojs/cqrs";

export class ListActiveStoriesQuery extends Query<"posts.listActiveStories"> {
  public constructor(
    public readonly viewerId: string,
    public readonly authorId: string | undefined,
  ) {
    super("posts.listActiveStories");
  }
}

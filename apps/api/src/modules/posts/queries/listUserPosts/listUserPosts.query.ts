import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { PageRequest } from "../../../../types/pagination.type.js";
import type { PostKind } from "../../models/posts.model.js";

export class ListUserPostsQuery extends Query<"posts.listUserPosts"> {
  public constructor(
    public readonly viewerId: string | undefined,
    public readonly authorId: string,
    public readonly kind: PostKind | undefined,
    public readonly page: PageRequest,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("posts.listUserPosts");
  }
}

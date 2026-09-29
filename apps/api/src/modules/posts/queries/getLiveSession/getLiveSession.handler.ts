import { QueryHandler } from "@zudojs/cqrs";

import type { LiveSessionDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { GetLiveSessionQuery } from "./getLiveSession.query.js";

export class GetLiveSessionHandler extends QueryHandler<GetLiveSessionQuery, LiveSessionDto> {
  public readonly queryType = "posts.getLiveSession" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(query: GetLiveSessionQuery): Promise<LiveSessionDto> {
    const session = await this.postsService.findLiveSessionOrThrow(query.sessionId);
    const [dto] = await this.postsService.presenter.presentLiveSessions([session], query.displayCurrency);
    return dto as LiveSessionDto;
  }
}

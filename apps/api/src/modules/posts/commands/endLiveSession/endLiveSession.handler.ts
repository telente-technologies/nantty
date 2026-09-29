import { CommandHandler } from "@zudojs/cqrs";

import type { LiveSessionDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { EndLiveSessionCommand } from "./endLiveSession.command.js";

export class EndLiveSessionHandler extends CommandHandler<EndLiveSessionCommand, LiveSessionDto> {
  public readonly commandType = "posts.endLiveSession" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: EndLiveSessionCommand): Promise<LiveSessionDto> {
    const { liveSessions, clock } = this.postsService.dependencies;
    const session = await this.postsService.findLiveSessionOrThrow(command.sessionId);
    this.postsService.assertIsLiveHost(session, command.principal.userId);
    await liveSessions.end(session.id, clock.now());
    const [dto] = await this.postsService.presenter.presentLiveSessions([await this.postsService.findLiveSessionOrThrow(session.id)], command.displayCurrency);
    return dto as LiveSessionDto;
  }
}

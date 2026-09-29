import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { LiveSessionDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { JoinLiveSessionCommand } from "./joinLiveSession.command.js";

export class JoinLiveSessionHandler extends CommandHandler<JoinLiveSessionCommand, LiveSessionDto> {
  public readonly commandType = "posts.joinLiveSession" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: JoinLiveSessionCommand): Promise<LiveSessionDto> {
    const { liveSessions, clock } = this.postsService.dependencies;
    const session = await this.postsService.findActiveLiveSessionOrThrow(command.sessionId, command.principal.userId);
    const updated = await liveSessions.addViewer(session.id, command.principal.userId, clock.now());
    if (updated === undefined) throw notFound("Live session");
    const [dto] = await this.postsService.presenter.presentLiveSessions([updated], command.displayCurrency);
    return dto as LiveSessionDto;
  }
}

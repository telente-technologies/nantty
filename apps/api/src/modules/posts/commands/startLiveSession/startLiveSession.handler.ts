import { CommandHandler } from "@zudojs/cqrs";

import type { LiveSessionDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { StartLiveSessionCommand } from "./startLiveSession.command.js";

export class StartLiveSessionHandler extends CommandHandler<StartLiveSessionCommand, LiveSessionDto> {
  public readonly commandType = "posts.startLiveSession" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: StartLiveSessionCommand): Promise<LiveSessionDto> {
    const { liveSessions, storeAccess, clock, creatorAccess } = this.postsService.dependencies;
    const hostId = command.principal.userId;
    await creatorAccess.assertApprovedCreator(hostId);
    if (command.input.storeId !== undefined) await storeAccess.assertStoreMember(hostId, command.input.storeId);
    await this.postsService.findPublishedProductsOrThrow(command.input.productIds ?? []);
    const session = await liveSessions.create({
      hostId,
      storeId: command.input.storeId ?? null,
      title: command.input.title.trim(),
      productIds: [...new Set(command.input.productIds ?? [])],
      startedAt: clock.now(),
    });
    const [dto] = await this.postsService.presenter.presentLiveSessions([session], command.displayCurrency);
    return dto as LiveSessionDto;
  }
}

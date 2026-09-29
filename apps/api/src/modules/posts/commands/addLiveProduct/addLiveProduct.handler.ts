import { CommandHandler } from "@zudojs/cqrs";

import { notFound, unprocessable } from "../../../../errors/domain.error.js";
import type { LiveSessionDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { AddLiveProductCommand } from "./addLiveProduct.command.js";

export class AddLiveProductHandler extends CommandHandler<AddLiveProductCommand, LiveSessionDto> {
  public readonly commandType = "posts.addLiveProduct" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: AddLiveProductCommand): Promise<LiveSessionDto> {
    const session = await this.postsService.findLiveSessionOrThrow(command.sessionId);
    this.postsService.assertIsLiveHost(session, command.principal.userId);
    if (session.status !== "live") throw unprocessable("This live session has ended.");
    await this.postsService.findPublishedProductsOrThrow([command.productId]);
    const updated = await this.postsService.dependencies.liveSessions.addProduct(session.id, command.productId, command.pin);
    if (updated === undefined) throw notFound("Live session");
    const [dto] = await this.postsService.presenter.presentLiveSessions([updated], command.displayCurrency);
    return dto as LiveSessionDto;
  }
}

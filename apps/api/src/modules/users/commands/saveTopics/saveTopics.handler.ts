import { CommandHandler } from "@zudojs/cqrs";

import { MIN_SELECTED_TOPICS } from "../../../../constants/security.constant.js";
import { unprocessable } from "../../../../errors/domain.error.js";
import type { TopicRecord } from "../../models/users.model.js";
import type { UsersService } from "../../services/users.service.js";
import type { SaveTopicsCommand } from "./saveTopics.command.js";

export class SaveTopicsHandler extends CommandHandler<SaveTopicsCommand, readonly TopicRecord[]> {
  public readonly commandType = "users.saveTopics" as const;

  public constructor(private readonly usersService: UsersService) {
    super();
  }

  public async execute(command: SaveTopicsCommand): Promise<readonly TopicRecord[]> {
    const { topics } = this.usersService.dependencies;
    const uniqueTopicIds = [...new Set(command.topicIds)];
    const knownTopics = await topics.findManyByIds(uniqueTopicIds);
    if (knownTopics.length !== uniqueTopicIds.length) throw unprocessable("One or more topics do not exist.");
    if (knownTopics.length < MIN_SELECTED_TOPICS) throw unprocessable(`Pick at least ${MIN_SELECTED_TOPICS} topics.`);
    await topics.replaceSelectedTopicsForUser(command.principal.userId, uniqueTopicIds);
    return knownTopics;
  }
}

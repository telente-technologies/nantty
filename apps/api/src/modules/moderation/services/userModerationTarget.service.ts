import type { ModerationTargetDescription, ModerationTargetGateway } from "../../../interfaces/moderationTargets.interface.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";

export class UserModerationTarget implements ModerationTargetGateway {
  public readonly targetType = "user" as const;

  public constructor(private readonly userDirectory: UserDirectory) {}

  public async describeTarget(userId: string): Promise<ModerationTargetDescription | undefined> {
    const [user] = await this.userDirectory.findUserSummaries([userId]);
    return user === undefined ? undefined : { ownerUserId: user.id, summary: `@${user.username}` };
  }

  public async applyContentAction(): Promise<boolean> {
    return false;
  }
}

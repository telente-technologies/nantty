import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { StoreMemberRecord } from "../../models/stores.model.js";
import type { StoresService } from "../../services/stores.service.js";
import type { AddStoreMemberCommand } from "./addStoreMember.command.js";

export class AddStoreMemberHandler extends CommandHandler<AddStoreMemberCommand, StoreMemberRecord> {
  public readonly commandType = "stores.addStoreMember" as const;

  public constructor(private readonly storesService: StoresService) {
    super();
  }

  public async execute(command: AddStoreMemberCommand): Promise<StoreMemberRecord> {
    const { stores, storeAccess, userDirectory, audit } = this.storesService.dependencies;
    await storeAccess.assertStoreOwner(command.principal.userId, command.storeId);
    const [invitedUser] = await userDirectory.findUserSummaries([command.input.userId]);
    if (invitedUser === undefined) throw notFound("User");
    const member = await stores.addMember(command.storeId, invitedUser.id, command.input.role);
    await audit.record({
      actorId: command.principal.userId,
      action: "stores.member_added",
      entityType: "store",
      entityId: command.storeId,
      metadata: { memberUserId: invitedUser.id, role: command.input.role },
    });
    return member;
  }
}

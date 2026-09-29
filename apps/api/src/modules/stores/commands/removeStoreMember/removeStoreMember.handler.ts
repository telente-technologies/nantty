import { CommandHandler } from "@zudojs/cqrs";

import { StoreRole } from "../../../../constants/roles.constant.js";
import { notFound, unprocessable } from "../../../../errors/domain.error.js";
import type { StoresService } from "../../services/stores.service.js";
import type { RemoveStoreMemberCommand } from "./removeStoreMember.command.js";

export class RemoveStoreMemberHandler extends CommandHandler<RemoveStoreMemberCommand, void> {
  public readonly commandType = "stores.removeStoreMember" as const;

  public constructor(private readonly storesService: StoresService) {
    super();
  }

  public async execute(command: RemoveStoreMemberCommand): Promise<void> {
    const { stores, storeAccess, audit } = this.storesService.dependencies;
    await storeAccess.assertStoreOwner(command.principal.userId, command.storeId);
    const member = await stores.findMember(command.storeId, command.memberUserId);
    if (member === undefined) throw notFound("Store member");
    if (member.role === StoreRole.OWNER) throw unprocessable("The store owner cannot be removed.");
    await stores.removeMember(command.storeId, command.memberUserId);
    await audit.record({
      actorId: command.principal.userId,
      action: "stores.member_removed",
      entityType: "store",
      entityId: command.storeId,
      metadata: { memberUserId: command.memberUserId, role: member.role },
    });
  }
}

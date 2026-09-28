import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { UsersService } from "../../services/users.service.js";
import type { RemoveAddressCommand } from "./removeAddress.command.js";

export class RemoveAddressHandler extends CommandHandler<RemoveAddressCommand, void> {
  public readonly commandType = "users.removeAddress" as const;

  public constructor(private readonly usersService: UsersService) {
    super();
  }

  public async execute(command: RemoveAddressCommand): Promise<void> {
    const removed = await this.usersService.dependencies.addresses.delete(command.principal.userId, command.addressId);
    if (!removed) throw notFound("Address");
  }
}

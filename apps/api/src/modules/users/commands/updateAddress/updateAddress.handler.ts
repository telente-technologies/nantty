import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { normalizePhoneNumber } from "../../../auth/services/contact.service.js";
import type { AddressDto } from "../../dtos/users.dto.js";
import type { UsersService } from "../../services/users.service.js";
import type { UpdateAddressCommand } from "./updateAddress.command.js";

export class UpdateAddressHandler extends CommandHandler<UpdateAddressCommand, AddressDto> {
  public readonly commandType = "users.updateAddress" as const;

  public constructor(private readonly usersService: UsersService) {
    super();
  }

  public async execute(command: UpdateAddressCommand): Promise<AddressDto> {
    const { addresses, cipher } = this.usersService.dependencies;
    const userId = command.principal.userId;
    const { phone, country, ...fields } = command.changes;
    const updated = await addresses.update(userId, command.addressId, {
      ...fields,
      ...(country === undefined ? {} : { country: country.toUpperCase() }),
      ...(phone === undefined ? {} : { phoneEncrypted: await cipher.encryptText(normalizePhoneNumber(phone)) }),
    });
    if (updated === undefined) throw notFound("Address");
    if (updated.isDefault) await addresses.clearDefaultExcept(userId, updated.id);
    return this.usersService.convertAddressWithDecryptedPhone(updated);
  }
}

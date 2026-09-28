import { CommandHandler } from "@zudojs/cqrs";

import { normalizePhoneNumber } from "../../../auth/services/contact.service.js";
import type { AddressDto } from "../../dtos/users.dto.js";
import type { UsersService } from "../../services/users.service.js";
import type { AddAddressCommand } from "./addAddress.command.js";

export class AddAddressHandler extends CommandHandler<AddAddressCommand, AddressDto> {
  public readonly commandType = "users.addAddress" as const;

  public constructor(private readonly usersService: UsersService) {
    super();
  }

  public async execute(command: AddAddressCommand): Promise<AddressDto> {
    const { addresses, cipher } = this.usersService.dependencies;
    const userId = command.principal.userId;
    const { phone, ...fields } = command.input;
    const existing = await addresses.listForUser(userId);
    const isDefault = fields.isDefault ?? existing.length === 0;
    const address = await addresses.create(userId, {
      label: fields.label ?? "",
      fullName: fields.fullName,
      phoneEncrypted: await cipher.encryptText(normalizePhoneNumber(phone)),
      line1: fields.line1,
      line2: fields.line2 ?? "",
      city: fields.city,
      state: fields.state,
      country: (fields.country ?? "NG").toUpperCase(),
      postalCode: fields.postalCode ?? "",
      isDefault,
    });
    if (isDefault) await addresses.clearDefaultExcept(userId, address.id);
    return this.usersService.convertAddressWithDecryptedPhone(address);
  }
}

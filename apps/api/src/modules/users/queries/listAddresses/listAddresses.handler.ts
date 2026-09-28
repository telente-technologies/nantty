import { QueryHandler } from "@zudojs/cqrs";

import type { AddressDto } from "../../dtos/users.dto.js";
import type { UsersService } from "../../services/users.service.js";
import type { ListAddressesQuery } from "./listAddresses.query.js";

export class ListAddressesHandler extends QueryHandler<ListAddressesQuery, readonly AddressDto[]> {
  public readonly queryType = "users.listAddresses" as const;

  public constructor(private readonly usersService: UsersService) {
    super();
  }

  public async execute(query: ListAddressesQuery): Promise<readonly AddressDto[]> {
    const addresses = await this.usersService.dependencies.addresses.listForUser(query.principal.userId);
    return Promise.all(addresses.map((address) => this.usersService.convertAddressWithDecryptedPhone(address)));
  }
}

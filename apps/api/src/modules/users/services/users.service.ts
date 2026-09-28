import type { EventBus } from "@zudojs/events";

import { notFound } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { FieldCipher } from "../../../utils/crypto.util.js";
import type { SessionsRepository } from "../../auth/repositories/auth.repository.js";
import { convertAddressToDto, type AddressDto } from "../dtos/users.dto.js";
import type { AddressRecord, UserRecord } from "../models/users.model.js";
import type { AddressesRepository } from "../repositories/addresses.repository.js";
import type { TopicsRepository } from "../repositories/topics.repository.js";
import type { UsersRepository } from "../repositories/users.repository.js";

export interface UsersDependencies {
  readonly users: UsersRepository;
  readonly addresses: AddressesRepository;
  readonly topics: TopicsRepository;
  readonly sessions: SessionsRepository;
  readonly cipher: FieldCipher;
  readonly events: EventBus;
  readonly clock: Clock;
  readonly audit: AuditRecorder;
}

export class UsersService {
  public constructor(public readonly dependencies: UsersDependencies) {}

  public async findActiveUserOrThrow(userId: string): Promise<UserRecord> {
    const user = await this.dependencies.users.findById(userId);
    if (user === undefined || user.status !== "active") throw notFound("User");
    return user;
  }

  public async convertAddressWithDecryptedPhone(address: AddressRecord): Promise<AddressDto> {
    return convertAddressToDto(address, await this.dependencies.cipher.decryptText(address.phoneEncrypted));
  }
}

import { randomUUID } from "node:crypto";

import { prisma } from "../../../integrations/database.integration.js";
import type { AddressFields, AddressRecord } from "../models/users.model.js";

export interface AddressesRepository {
  listForUser(userId: string): Promise<readonly AddressRecord[]>;
  findOwnedAddress(userId: string, addressId: string): Promise<AddressRecord | undefined>;
  create(userId: string, fields: AddressFields): Promise<AddressRecord>;
  update(userId: string, addressId: string, fields: Partial<AddressFields>): Promise<AddressRecord | undefined>;
  delete(userId: string, addressId: string): Promise<boolean>;
  clearDefaultExcept(userId: string, addressId: string): Promise<void>;
}

export class InMemoryAddressesRepository implements AddressesRepository {
  private readonly addresses = new Map<string, AddressRecord>();

  public async listForUser(userId: string): Promise<readonly AddressRecord[]> {
    return [...this.addresses.values()].filter((address) => address.userId === userId);
  }

  public async findOwnedAddress(userId: string, addressId: string): Promise<AddressRecord | undefined> {
    const address = this.addresses.get(addressId);
    return address?.userId === userId ? address : undefined;
  }

  public async create(userId: string, fields: AddressFields): Promise<AddressRecord> {
    const address: AddressRecord = { ...fields, id: randomUUID(), userId, createdAt: new Date() };
    this.addresses.set(address.id, address);
    return address;
  }

  public async update(userId: string, addressId: string, fields: Partial<AddressFields>): Promise<AddressRecord | undefined> {
    const existing = await this.findOwnedAddress(userId, addressId);
    if (existing === undefined) return undefined;
    const updated = { ...existing, ...fields };
    this.addresses.set(addressId, updated);
    return updated;
  }

  public async delete(userId: string, addressId: string): Promise<boolean> {
    if ((await this.findOwnedAddress(userId, addressId)) === undefined) return false;
    return this.addresses.delete(addressId);
  }

  public async clearDefaultExcept(userId: string, addressId: string): Promise<void> {
    for (const address of await this.listForUser(userId)) {
      if (address.id !== addressId && address.isDefault) this.addresses.set(address.id, { ...address, isDefault: false });
    }
  }
}

function convertAddressRowToRecord(row: {
  id: string; userId: string; label: string; fullName: string; phoneEnc: string; line1: string; line2: string;
  city: string; state: string; country: string; postalCode: string; isDefault: boolean; createdAt: Date;
}): AddressRecord {
  const { phoneEnc, ...rest } = row;
  return { ...rest, phoneEncrypted: phoneEnc };
}

function convertAddressFieldsToColumns(fields: Partial<AddressFields>) {
  const { phoneEncrypted, ...rest } = fields;
  return { ...rest, ...(phoneEncrypted === undefined ? {} : { phoneEnc: phoneEncrypted }) };
}

export class PrismaAddressesRepository implements AddressesRepository {
  public async listForUser(userId: string): Promise<readonly AddressRecord[]> {
    const rows = await prisma().address.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    return rows.map(convertAddressRowToRecord);
  }

  public async findOwnedAddress(userId: string, addressId: string): Promise<AddressRecord | undefined> {
    const row = await prisma().address.findFirst({ where: { id: addressId, userId } });
    return row === null ? undefined : convertAddressRowToRecord(row);
  }

  public async create(userId: string, fields: AddressFields): Promise<AddressRecord> {
    const { phoneEncrypted, ...rest } = fields;
    const row = await prisma().address.create({ data: { ...rest, phoneEnc: phoneEncrypted, userId } });
    return convertAddressRowToRecord(row);
  }

  public async update(userId: string, addressId: string, fields: Partial<AddressFields>): Promise<AddressRecord | undefined> {
    const result = await prisma().address.updateMany({ where: { id: addressId, userId }, data: convertAddressFieldsToColumns(fields) });
    return result.count === 0 ? undefined : this.findOwnedAddress(userId, addressId);
  }

  public async delete(userId: string, addressId: string): Promise<boolean> {
    const result = await prisma().address.deleteMany({ where: { id: addressId, userId } });
    return result.count > 0;
  }

  public async clearDefaultExcept(userId: string, addressId: string): Promise<void> {
    await prisma().address.updateMany({ where: { userId, isDefault: true, NOT: { id: addressId } }, data: { isDefault: false } });
  }
}

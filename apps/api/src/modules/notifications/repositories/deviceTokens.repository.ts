import { randomUUID } from "node:crypto";

import { prisma } from "../../../integrations/database.integration.js";
import type { DevicePlatform, DeviceTokenRecord } from "../models/notifications.model.js";

export interface DeviceTokensRepository {
  registerTokenForUser(userId: string, token: string, platform: DevicePlatform, createdAt: Date): Promise<DeviceTokenRecord>;
  listTokensForUser(userId: string): Promise<readonly DeviceTokenRecord[]>;
  deleteOwnToken(userId: string, token: string): Promise<boolean>;
}

export class InMemoryDeviceTokensRepository implements DeviceTokensRepository {
  private readonly tokens = new Map<string, DeviceTokenRecord>();

  public async registerTokenForUser(userId: string, token: string, platform: DevicePlatform, createdAt: Date): Promise<DeviceTokenRecord> {
    const record: DeviceTokenRecord = { id: this.tokens.get(token)?.id ?? randomUUID(), userId, token, platform, createdAt };
    this.tokens.set(token, record);
    return record;
  }

  public async listTokensForUser(userId: string): Promise<readonly DeviceTokenRecord[]> {
    return [...this.tokens.values()].filter((record) => record.userId === userId);
  }

  public async deleteOwnToken(userId: string, token: string): Promise<boolean> {
    if (this.tokens.get(token)?.userId !== userId) return false;
    return this.tokens.delete(token);
  }
}

function convertDeviceTokenRowToRecord(row: { id: string; userId: string; token: string; platform: string; createdAt: Date }): DeviceTokenRecord {
  return { ...row, platform: row.platform as DevicePlatform };
}

export class PrismaDeviceTokensRepository implements DeviceTokensRepository {
  public async registerTokenForUser(userId: string, token: string, platform: DevicePlatform, createdAt: Date): Promise<DeviceTokenRecord> {
    const row = await prisma().deviceToken.upsert({
      where: { token },
      create: { userId, token, platform, createdAt },
      update: { userId, platform },
    });
    return convertDeviceTokenRowToRecord(row);
  }

  public async listTokensForUser(userId: string): Promise<readonly DeviceTokenRecord[]> {
    return (await prisma().deviceToken.findMany({ where: { userId } })).map(convertDeviceTokenRowToRecord);
  }

  public async deleteOwnToken(userId: string, token: string): Promise<boolean> {
    const result = await prisma().deviceToken.deleteMany({ where: { userId, token } });
    return result.count > 0;
  }
}

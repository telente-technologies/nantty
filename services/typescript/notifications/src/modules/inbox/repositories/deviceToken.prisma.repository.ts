import type { PrismaClient } from "../../../databases/prisma.database.js";
import type { DeviceTokenRepository } from "../../../interfaces/repositories.interface.js";

export class DeviceTokenPrismaRepository implements DeviceTokenRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async register(userId: string, token: string, platform: string): Promise<void> {
    await this.prisma.deviceToken.upsert({ where: { token }, create: { userId, token, platform }, update: { userId, platform } });
  }

  public async remove(userId: string, token: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { userId, token } });
  }

  public async listTokens(userId: string): Promise<readonly string[]> {
    return (await this.prisma.deviceToken.findMany({ where: { userId }, select: { token: true } })).map((row) => row.token);
  }
}

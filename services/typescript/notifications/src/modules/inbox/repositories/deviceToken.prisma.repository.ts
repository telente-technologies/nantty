import type { PrismaClient } from "../../../databases/prisma.database.js";
import type { DeviceTokenRepository } from "../../../interfaces/repositories.interface.js";
import type { PushProvider } from "../../../interfaces/pushSender.interface.js";

export class DeviceTokenPrismaRepository implements DeviceTokenRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async register(userId: string, token: string, platform: string, provider: PushProvider = "expo"): Promise<void> {
    await this.prisma.deviceToken.upsert({ where: { token }, create: { userId, token, platform, provider }, update: { userId, platform, provider } });
  }

  public async remove(userId: string, token: string, provider?: PushProvider): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { userId, token, ...(provider === undefined ? {} : { provider }) } });
  }

  public async listTokens(userId: string): Promise<readonly string[]> {
    return (await this.prisma.deviceToken.findMany({ where: { userId }, select: { token: true } })).map((row) => row.token);
  }

  public async listRegistrations(userId: string) {
    const registrations = await this.prisma.deviceToken.findMany({ where: { userId }, select: { token: true, provider: true } });
    return registrations.map(({ token, provider }) => ({ token, provider: provider === "fcm" ? "fcm" as const : "expo" as const }));
  }
}

import type { PrismaClient } from "../../../databases/prisma.database.js";
import type { UnsubscribeReceiptRepository } from "../../../interfaces/repositories.interface.js";

export class UnsubscribeReceiptPrismaRepository implements UnsubscribeReceiptRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async claim(tokenHash: string, accountId: string): Promise<boolean> {
    const result = await this.prisma.unsubscribeReceipt.createMany({ data: [{ tokenHash, accountId }], skipDuplicates: true });
    return result.count === 1;
  }

  public async release(tokenHash: string): Promise<void> {
    await this.prisma.unsubscribeReceipt.deleteMany({ where: { tokenHash } });
  }
}

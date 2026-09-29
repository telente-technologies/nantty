import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { DEFAULT_COIN_PACKS } from "../../src/modules/coins/seeds/defaultCoinPacks.seed.js";

export async function seedCoinPacks(prisma: PrismaClient): Promise<void> {
  for (const pack of DEFAULT_COIN_PACKS) {
    await prisma.coinPack.upsert({ where: { id: pack.id }, create: { ...pack, prices: { ...pack.prices } }, update: {} });
  }
  process.stdout.write(`Seeded ${DEFAULT_COIN_PACKS.length} coin packs (existing packs are left as admins configured them).\n`);
}

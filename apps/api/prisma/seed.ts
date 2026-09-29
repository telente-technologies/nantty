import { PrismaPg } from "@prisma/adapter-pg";

import { DEFAULT_CATEGORIES, DEFAULT_TOPICS } from "../src/constants/seedData.constant.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedCoinPacks } from "./seeds/coinPacks.seed.js";
import { seedSubscriptionPlans } from "./seeds/subscriptionPlans.seed.js";

try {
  process.loadEnvFile(".env");
} catch {
  process.stdout.write("No .env file; reading DATABASE_URL from the environment.\n");
}

const connectionString = process.env["DATABASE_URL"] ?? "";
if (connectionString === "") throw new Error("DATABASE_URL is not set.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function seedTopicsAndCategories(): Promise<void> {
  for (const [order, topic] of DEFAULT_TOPICS.entries()) {
    await prisma.topic.upsert({ where: { slug: topic.slug }, create: { ...topic, order }, update: { name: topic.name, order } });
  }
  for (const [sortOrder, category] of DEFAULT_CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: { ...category, sortOrder },
      update: { name: category.name, sortOrder },
    });
  }
}

try {
  await seedTopicsAndCategories();
  await seedSubscriptionPlans(prisma);
  await seedCoinPacks(prisma);
  process.stdout.write(`Seeded ${DEFAULT_TOPICS.length} topics and ${DEFAULT_CATEGORIES.length} categories.\n`);
} finally {
  await prisma.$disconnect();
}

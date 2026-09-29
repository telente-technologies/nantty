import type { Prisma, PrismaClient } from "../../src/generated/prisma/client.js";
import { DEFAULT_SUBSCRIPTION_PLANS } from "../../src/modules/subscriptions/seeds/defaultPlans.seed.js";

export async function seedSubscriptionPlans(prisma: PrismaClient): Promise<void> {
  for (const plan of DEFAULT_SUBSCRIPTION_PLANS) {
    const { id, color, tier, name, description, purchasable, trialDays, active, sortOrder } = plan;
    const existing = await prisma.subscriptionPlan.findUnique({ where: { color_tier: { color, tier } } });
    if (existing !== null) continue;
    await prisma.subscriptionPlan.create({
      data: {
        id, color, tier, name, description, purchasable, trialDays, active, sortOrder,
        prices: { create: plan.prices.map((price) => ({ interval: price.interval, currency: price.currency, amount: BigInt(price.amount) })) },
        entitlements: { create: plan.entitlements.map((entitlement) => ({ key: entitlement.key, value: entitlement.value as Prisma.InputJsonValue })) },
        perks: { create: plan.perks.map((perk, index) => ({ title: perk.title, description: perk.description, sortOrder: index })) },
      },
    });
  }
  process.stdout.write(`Seeded ${DEFAULT_SUBSCRIPTION_PLANS.length} subscription plans (existing plans are left as admins configured them).\n`);
}

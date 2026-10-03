import type { PremiumEntitlements } from "../interfaces/premiumEntitlements.interface.js";

export const noPremiumEntitlements: PremiumEntitlements = {
  isPremium: async () => false,
  hasSubscribedToCreator: async () => false,
};

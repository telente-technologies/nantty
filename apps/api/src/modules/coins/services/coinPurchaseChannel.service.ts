import type { CoinPurchaseChannel, CoinPurchasePlatform, MonetizationSettings } from "../../../configs/monetization.config.js";

export function chooseCoinPurchaseChannel(settings: MonetizationSettings, platform: CoinPurchasePlatform, countryCode: string | null): CoinPurchaseChannel {
  if (platform === "web") return "web_checkout";
  const rules = settings.coins.purchaseChannelRules.filter((rule) => rule.platform === platform);
  const countryRule = countryCode === null ? undefined : rules.find((rule) => rule.countryCode === countryCode);
  const platformRule = rules.find((rule) => rule.countryCode === null);
  return countryRule?.channel ?? platformRule?.channel ?? settings.coins.defaultPurchaseChannel;
}

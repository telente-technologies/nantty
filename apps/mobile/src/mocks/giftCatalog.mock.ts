import type { LiveGift, LiveGiftDisplayLevel, LiveGiftHaptic, LiveGiftTier } from "@/types";

type SeedGroup = "quick" | "fun" | "premium" | "legendary";

const TIER_BY_SEED_GROUP: Record<SeedGroup, LiveGiftTier> = { quick: "basic", fun: "basic", premium: "premium", legendary: "legendary" };
const DISPLAY_LEVEL_BY_SEED_GROUP: Record<SeedGroup, LiveGiftDisplayLevel> = { quick: "micro", fun: "medium", premium: "large", legendary: "global" };
const HAPTIC_BY_SEED_GROUP: Record<SeedGroup, LiveGiftHaptic> = { quick: "light", fun: "medium", premium: "heavy", legendary: "pattern" };

const seedGift = (group: SeedGroup, sortOrder: number, id: string, name: string, priceCoins: number, assetKey: string, durationMs: number): LiveGift => ({
  id: `gift_${id}`,
  name,
  tier: TIER_BY_SEED_GROUP[group],
  priceCoins,
  animationEngine: "lottie",
  animationAssetKey: assetKey,
  previewAssetKey: assetKey,
  durationMs,
  displayLevel: DISPLAY_LEVEL_BY_SEED_GROUP[group],
  sound: null,
  haptic: HAPTIC_BY_SEED_GROUP[group],
  comboable: group === "quick" || group === "fun",
  sortOrder,
  isActive: true,
});

export const mockLiveGiftCatalog: readonly LiveGift[] = [
  seedGift("quick", 1, "like", "Like", 1, "like-v1", 900),
  seedGift("quick", 2, "clap", "Clap", 1, "clap-v1", 900),
  seedGift("quick", 3, "fire", "Fire", 2, "fire-v1", 1_000),
  seedGift("quick", 4, "heart", "Heart", 5, "heart-v1", 1_200),
  seedGift("quick", 5, "star", "Star", 5, "star-v1", 1_200),
  seedGift("quick", 6, "thumbs_up", "Thumbs Up", 3, "thumbs-up-v1", 900),
  seedGift("quick", 7, "smile", "Smile", 3, "smile-v1", 900),
  seedGift("quick", 8, "sparkle", "Sparkle", 9, "sparkle-v1", 1_500),
  seedGift("fun", 10, "rose", "Rose", 10, "rose-v2", 2_200),
  seedGift("fun", 11, "gift_box", "Gift Box", 30, "gift-box-v1", 2_200),
  seedGift("fun", 12, "crown", "Crown", 99, "crown-v1", 2_400),
  seedGift("fun", 13, "diamond", "Diamond", 149, "diamond-v1", 2_400),
  seedGift("fun", 14, "rocket", "Rocket", 199, "rocket-v2", 2_500),
  seedGift("fun", 15, "lightning", "Lightning", 49, "lightning-v1", 2_000),
  seedGift("fun", 16, "fireworks", "Fireworks", 249, "fireworks-v1", 2_500),
  seedGift("fun", 17, "money_rain", "Money Rain", 299, "money-rain-v1", 2_500),
  seedGift("premium", 20, "golden_crown", "Golden Crown", 500, "golden-crown-v1", 4_000),
  seedGift("premium", 21, "luxury_car", "Luxury Car", 1_000, "luxury-car-v1", 4_500),
  seedGift("premium", 22, "private_jet", "Private Jet", 2_000, "private-jet-v1", 5_000),
  seedGift("premium", 23, "treasure_chest", "Treasure Chest", 1_500, "treasure-chest-v1", 4_500),
  seedGift("premium", 24, "diamond_shower", "Diamond Shower", 2_500, "diamond-shower-v1", 5_000),
  seedGift("premium", 25, "golden_rain", "Golden Rain", 3_000, "golden-rain-v1", 5_000),
  seedGift("premium", 26, "supernova", "Supernova", 4_000, "supernova-v1", 5_000),
  seedGift("legendary", 30, "nantty_galaxy", "Nantty Galaxy", 10_000, "nantty-galaxy-v1", 6_500),
  seedGift("legendary", 31, "nantty_king", "Nantty King", 20_000, "nantty-king-v1", 7_000),
  seedGift("legendary", 32, "nantty_empire", "Nantty Empire", 30_000, "nantty-empire-v1", 7_000),
];

export const findMockLiveGiftById = (giftId: string) => mockLiveGiftCatalog.find((gift) => gift.id === giftId);

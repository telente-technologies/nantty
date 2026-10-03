import { buildMockUserSummary } from "@/mocks/fixtures.mock";
import { mockLiveGiftCatalog } from "@/mocks/giftCatalog.mock";
import { recordMockLiveGiftEvent } from "@/mocks/gifts.mock";
import type { LiveGift, LiveGiftDisplayLevel, LiveGiftSentEvent, UserSummary } from "@/types";

const FIRST_SIMULATED_GIFT_DELAY_MS = 2_500;
const MINIMUM_SIMULATED_GIFT_GAP_MS = 3_000;
const RANDOM_EXTRA_SIMULATED_GIFT_GAP_MS = 4_000;
const COMBO_REPEAT_GAP_MS = 380;
const SIMULATED_VIEWER_COUNT = 9;

const pickWeightedRandomGift = (): LiveGift => {
  const roll = Math.random();
  const level: LiveGiftDisplayLevel = roll < 0.62 ? "micro" : roll < 0.9 ? "medium" : roll < 0.985 ? "large" : "global";
  const giftsInTier = mockLiveGiftCatalog.filter((gift) => gift.displayLevel === level);
  return giftsInTier[Math.floor(Math.random() * giftsInTier.length)]!;
};

const buildSimulatedGiftSentEvent = (liveId: string, receiverUserId: string, sender: UserSummary, gift: LiveGift, comboId: string, comboCount: number): LiveGiftSentEvent => ({
  type: "gift.sent",
  liveId,
  giftTransactionId: `gt_sim_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
  giftId: gift.id,
  animationAssetKey: gift.animationAssetKey,
  displayLevel: gift.displayLevel,
  quantity: 1,
  totalCoins: gift.priceCoins,
  sender: { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl },
  receiverUserId,
  comboId,
  comboCount,
});

export function startMockLiveGiftEmitter(liveId: string, receiverId: string, emit: (event: LiveGiftSentEvent) => void) {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const schedule = (callback: () => void, delayMs: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delayMs);
    timers.add(timer);
  };
  const sendRandomViewerGiftWithPossibleCombo = () => {
    const sender = buildMockUserSummary(Math.floor(Math.random() * SIMULATED_VIEWER_COUNT) + 3);
    const gift = pickWeightedRandomGift();
    const comboId = `cmb_sim_${Date.now().toString(36)}`;
    const repeatCount = gift.comboable ? 1 + Math.floor(Math.random() * (gift.displayLevel === "micro" ? 12 : 4)) : 1;
    for (let comboCount = 1; comboCount <= repeatCount; comboCount++) {
      schedule(() => {
        const event = buildSimulatedGiftSentEvent(liveId, receiverId, sender, gift, comboId, comboCount);
        recordMockLiveGiftEvent(event, sender.username);
        emit(event);
      }, (comboCount - 1) * COMBO_REPEAT_GAP_MS);
    }
    schedule(sendRandomViewerGiftWithPossibleCombo, MINIMUM_SIMULATED_GIFT_GAP_MS + repeatCount * COMBO_REPEAT_GAP_MS + Math.random() * RANDOM_EXTRA_SIMULATED_GIFT_GAP_MS);
  };
  schedule(sendRandomViewerGiftWithPossibleCombo, FIRST_SIMULATED_GIFT_DELAY_MS);
  return () => timers.forEach(clearTimeout);
}

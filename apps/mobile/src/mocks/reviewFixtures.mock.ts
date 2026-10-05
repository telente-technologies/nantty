import type { ProductReview } from "@/types/commerce.type";

import { buildMockUserSummary, isoDateHoursAgo } from "./fixtures.mock";
import { findCatalogSeedByProductId } from "./productCatalog.mock";

const REVIEW_TEXTS_BY_CATEGORY: Record<string, readonly string[]> = {
  cat_fashion: [
    "The fabric is even better in person. Wore it to my cousin's traditional wedding and got so many compliments",
    "Fit is true to size. Delivery to Abuja took 4 days but the seller kept me updated the whole time.",
    "Stitching is neat and the colours didn't run after the first wash. Will order the green one next.",
    "Slightly longer than I expected but my tailor adjusted it in 10 minutes. Quality is solid.",
    "Paid into escrow, confirmed when it arrived — smooth. Adaeze even added a thank-you note.",
  ],
  cat_shoes: [
    "Leather is genuinely soft and the sole grips well. Took about a week to break in.",
    "Ordered UK 10, fits perfectly. Packaging was neat and delivery was fast.",
    "Good value for the price. The white stays white if you wipe it after each wear.",
    "Had to exchange for a bigger size and Emeka sorted it within 3 days. Great service.",
  ],
  cat_gadgets: [
    "Original product, box was sealed and serial number checked out. Battery life is as advertised.",
    "Noise cancelling is surprisingly good on the BRT. Worth every naira.",
    "Arrived next day in Lagos. Tested it before confirming receipt — all working.",
    "Works well but the charging cable is short. Seller replied to my question in minutes.",
    "Third purchase from TundeTech. Consistent quality, no stories.",
  ],
  cat_beauty: [
    "My dark spots have faded noticeably after 5 weeks. Smells nice too, not like chemicals.",
    "Very gentle on my sensitive skin. No breakouts at all.",
    "Harmattan was no match for this. My skin stays soft all day.",
    "Packaging was secure, nothing leaked. Will definitely restock.",
  ],
  cat_home: [
    "The clay pot makes my egusi taste like my grandmother's. Arrived well packed, no cracks.",
    "Beautiful craftsmanship, looks even better on my dining table.",
    "The candle scent fills the whole parlour without being too strong. Burned for ages.",
    "One mug had a tiny chip and Temi replaced it immediately. Lovely seller.",
  ],
  cat_food: [
    "No stones at all in the Ofada. Cooked it with ayamase on Sunday — family finished everything.",
    "Suya spice tastes just like the mallam's by my house. Ordering the 500g next time.",
    "Fresh and well sealed. Delivery to Port Harcourt took 3 days.",
    "The chin chin didn't survive the weekend Crunchy and not too sweet.",
  ],
  cat_kids: [
    "My son loves the backpack! Survived two rainy school runs already.",
    "Soft fabric, snaps are easy. Wore it for her naming ceremony photos.",
    "Blocks are smooth and the paint is solid. Good quality for toddlers.",
    "The dress was a hit at the birthday party. Lining is soft, no itching.",
  ],
};

const REVIEWER_OFFSETS = [6, 9, 12, 7, 14, 18, 10, 16];

const MAX_SEEDED_REVIEWS = 26;

export function buildSeededReviewsForProduct(productId: string): ProductReview[] {
  const seed = findCatalogSeedByProductId(productId);
  if (!seed) return [];
  const texts = REVIEW_TEXTS_BY_CATEGORY[seed.categoryId] ?? REVIEW_TEXTS_BY_CATEGORY.cat_fashion!;
  const productNumber = seed.key.length + seed.key.charCodeAt(seed.key.length - 1);
  const total = Math.min(seed.reviewCount, MAX_SEEDED_REVIEWS);
  return Array.from({ length: total }, (_, index) => {
    const author = buildMockUserSummary(REVIEWER_OFFSETS[(index + productNumber) % REVIEWER_OFFSETS.length]! + index);
    return {
      id: `rv_${seed.key}_${index}`,
      author: { id: author.id, name: author.name, username: author.username, avatarUrl: author.avatarUrl },
      rating: index % 7 === 6 && seed.rating < 4.6 ? 3 : index % 3 === 2 ? 4 : 5,
      text: texts[index % texts.length]!,
      title: null,
      isVerifiedPurchase: true,
      reply: null,
      createdAt: isoDateHoursAgo(20 + index * 53 + productNumber),
    };
  });
}

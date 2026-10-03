import type { Product } from "@/types/catalog.type";
import type { OnlineOrder } from "@/types/order.type";
import type { Review } from "@/types/review.type";
import { buildIsoDateDaysAgo, createSeededRandomNumberGenerator, pickRandomIntegerInclusive, pickRandomItem } from "@/mocks/seed/seededRandom.mock";

const reviewTextsByRating: Record<number, readonly (readonly [string | null, string])[]> = {
  5: [
    ["Worth every naira", "Exactly like the pictures. Delivery to my office in Yaba took two days and it came well packed."],
    ["My sister wants one too", "Quality is top notch. I have washed it three times and the colour is still sharp."],
    [null, "Fast reply in chat and the seller even added a thank-you note. Will buy again."],
    ["Perfect for owambe", "Got so many compliments at my cousin's wedding. Size guide was accurate."],
    ["Legit seller", "Was scared of buying online but escrow made it easy. Item is original."],
  ],
  4: [
    ["Very good", "Nice product. Took one extra day to arrive in Abuja but the seller kept me updated."],
    [null, "Good quality for the price. Packaging could be better but no damage."],
    ["Happy overall", "Colour is slightly darker than the photo, still love it."],
  ],
  3: [
    ["It's okay", "Product is fine but delivery took almost a week to Port Harcourt."],
    [null, "Average. I expected the material to be thicker for this price."],
  ],
  2: [
    ["Not what I expected", "The size runs small. I had to give it to my younger brother."],
    [null, "Item arrived with a scratch. Seller offered a replacement, waiting to see."],
  ],
  1: [
    ["Disappointed", "Ordered black and got navy. Still waiting for a reply about the return."],
    [null, "Delivery was very late and the rider kept asking me to come out to the junction."],
  ],
};

const replyTexts = [
  "Thank you so much for the kind words! We are glad it arrived safely — see you again soon.",
  "Sorry about the delay. We have changed our dispatch partner for your area. Please send us a message so we can make it right.",
  "Thanks for the feedback. We have added clearer size notes to the product page.",
];

export function buildDemoReviews(products: readonly Product[], orders: readonly OnlineOrder[], seed: number, storeName: string): Review[] {
  const random = createSeededRandomNumberGenerator(seed);
  const reviewableOrders = orders.filter((order) => order.status === "delivered" || order.status === "completed");
  const sourceOrders = reviewableOrders.length > 0 ? reviewableOrders : orders;
  if (sourceOrders.length === 0) return [];
  return Array.from({ length: 46 }, (_, index) => {
    const order = pickRandomItem(sourceOrders, random);
    const line = order.lines[0];
    const product = products.find((candidate) => candidate.id === line?.productId) ?? null;
    const roll = random();
    const rating = roll < 0.52 ? 5 : roll < 0.78 ? 4 : roll < 0.88 ? 3 : roll < 0.95 ? 2 : 1;
    const [title, body] = pickRandomItem(reviewTextsByRating[rating] ?? [], random);
    const isStoreReview = index % 6 === 5 || !product;
    const daysAgo = pickRandomIntegerInclusive(0, 175, random);
    const hasReply = rating <= 3 ? random() < 0.55 : random() < 0.4;
    return {
      id: `rev_${seed}_${index + 1}`,
      kind: isStoreReview ? "store" : "product",
      product: isStoreReview || !product ? null : { id: product.id, name: product.name, imageUrl: product.images[0]?.url ?? null },
      rating,
      title: isStoreReview && title ? `${title} — ${storeName}` : title,
      body,
      author: { name: order.buyer.name, username: order.buyer.username },
      orderNumber: order.orderNumber,
      isVerifiedPurchase: true,
      photoCount: random() < 0.3 ? pickRandomIntegerInclusive(1, 4, random) : 0,
      helpfulCount: pickRandomIntegerInclusive(0, 24, random),
      status: index === 13 ? "reported" : "published",
      reply: hasReply ? { body: replyTexts[rating >= 4 ? 0 : rating === 3 ? 2 : 1] ?? "", authorName: storeName, createdAt: buildIsoDateDaysAgo(Math.max(0, daysAgo - 1), 15), updatedAt: null } : null,
      createdAt: buildIsoDateDaysAgo(daysAgo, pickRandomIntegerInclusive(7, 22, random)),
    } satisfies Review;
  }).sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

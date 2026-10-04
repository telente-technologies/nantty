import type { Media, Post } from "@/types";

import { isoDateHoursAgo } from "./fixtures.mock";
import { postImageUrlsForPhotoKey, productImageUrlsForProduct, type CatalogProductKey, type DirectoryUserKey, type PostPhotoKey } from "./mockImages.mock";
import {
  buildCatalogProductSummary,
  buildSponsoredPlacementForSeed,
  catalogProductSeeds,
  findCatalogSeedByProductId,
  productSummaryByKey,
} from "./productCatalog.mock";
import { buildFriendsLikedFromFollowedUsers, isFollowingUser } from "./socialGraph.mock";
import { isTargetSavedByViewer } from "./saveState.mock";
import { buildRichSponsoredPosts } from "./richAds.mock";
import { userSummaryById } from "./userDirectory.mock";
import type { LinkPreview } from "@/types/linkPreview.type";

type EngagementNumbers = readonly [likes: number, comments: number, reposts: number, views: number];

interface PostSeed {
  readonly id: string;
  readonly authorKey: DirectoryUserKey;
  readonly hoursAgo: number;
  readonly text: string;
  readonly photoKey?: PostPhotoKey;
  readonly productKeys?: readonly CatalogProductKey[];
  readonly engagement: EngagementNumbers;
  readonly likedByFriends?: readonly DirectoryUserKey[];
  readonly linkPreview?: LinkPreview;
}

const MAXIMUM_IMAGES_PER_POST = 10;

const POST_SEEDS: readonly PostSeed[] = [
  { id: "post_1", authorKey: "u_1", hoursAgo: 6, productKeys: ["f1", "f2", "f3", "f5"], engagement: [2840, 312, 96, 48_200], text: "New drop! 🧵 The Owambe Edit is live — wrap dresses, Adire sets and senator kaftans for the men. Every order is paid into escrow, so you only release payment when it fits. Tap the bag to shop 👇" },
  { id: "post_2", authorKey: "u_7", hoursAgo: 3, engagement: [412, 58, 21, 6_300], text: "Finally shipped the feature I've been debugging for 3 days. The bug? A missing await. I'm going to go and lie down." },
  { id: "post_3", authorKey: "u_10", hoursAgo: 9, photoKey: "jollofRice", engagement: [1930, 406, 88, 31_000], likedByFriends: ["u_7", "u_12", "u_15"], text: "Rating Lagos jollof spots, part 7 🍛 This one in Surulere had that proper party-rice smokiness. 8.5/10. Where should I go next?" },
  { id: "post_4", authorKey: "u_2", hoursAgo: 12, productKeys: ["g6", "g1"], engagement: [1210, 143, 40, 22_700], text: "Your commute is about to get quieter 🎧 Over-ear ANC headphones are back in stock, and the earbuds are 25% off today only. Original, sealed, 1-year warranty." },
  { id: "post_5", authorKey: "u_15", hoursAgo: 20, photoKey: "beachSunset", engagement: [880, 97, 30, 12_400], text: "Sunset at Tarkwa Bay hits different after a week of traffic 🌅 Twenty minutes on the boat from the jetty and you're in another world." },
  { id: "post_6", authorKey: "u_9", hoursAgo: 26, photoKey: "weddingAsoEbi", engagement: [3120, 254, 112, 54_000], likedByFriends: ["u_1", "u_10"], text: "Shot my 40th wedding of the year this weekend 📸 The aso-ebi coordination was on another level. Congratulations Tolu & Kunle!" },
  { id: "post_7", authorKey: "u_3", hoursAgo: 30, productKeys: ["b3", "b1", "b2"], engagement: [1640, 221, 57, 26_900], text: "Your harmattan skincare routine, sorted ✨ Vitamin C serum for dark spots, whipped shea for the dryness and black soap to keep things clear. Made in Abuja 💛" },
  { id: "post_8", authorKey: "u_12", hoursAgo: 34, photoKey: "gymWorkout", engagement: [2210, 187, 140, 33_500], text: "No gym? No excuse. 20 minutes: 3 rounds of 15 squats, 10 push-ups and a 30-second plank. Tag someone who needs to start today 💪" },
  { id: "post_9", authorKey: "u_me", hoursAgo: 38, productKeys: ["h2", "h1", "h4"], engagement: [640, 73, 18, 9_800], text: "Sunday pots 🏺 Fresh from our potters in Ibadan — clay pots with lids, raffia placemats and lemongrass candles for the dining table. Only 5 pots in this batch." },
  { id: "post_10", authorKey: "u_11", hoursAgo: 44, photoKey: "booksCoffee", engagement: [310, 41, 9, 3_900], text: "Rainy Saturday, second cup of coffee and Half of a Yellow Sun for the third time. Some books just hold you." },
  { id: "post_11", authorKey: "u_4", hoursAgo: 50, productKeys: ["fd1", "fd2", "fd6"], engagement: [970, 164, 51, 15_200], text: "December is coming o! 🎄 Stock up on stone-free Ofada rice, fresh yaji and my famous chin chin before prices go up. We deliver everywhere in Nigeria." },
  { id: "post_12", authorKey: "u_14", hoursAgo: 56, photoKey: "footballMatch", engagement: [520, 133, 26, 7_100], text: "Super Eagles, why do you people like to raise my blood pressure? 😩 Anyway, we move. Next match we win." },
  { id: "post_13", authorKey: "u_5", hoursAgo: 60, productKeys: ["k1", "k3", "k4"], engagement: [760, 88, 22, 11_600], text: "Back-to-school and party season at the same time? We've got you 🎒👗 New backpacks, tulle party dresses and the softest Ankara rompers for the little ones." },
  { id: "post_14", authorKey: "u_8", hoursAgo: 66, photoKey: "lagosSkyline", engagement: [1480, 102, 64, 19_800], likedByFriends: ["u_9", "u_13"], text: "Lagos from 20 floors up. Chaotic, loud and still my favourite city 🌇" },
  { id: "post_15", authorKey: "u_6", hoursAgo: 72, productKeys: ["s1", "s2", "s4"], engagement: [1105, 130, 47, 17_300], text: "Aba made, world class 👞 Loafers, Chelseas and clean white sneakers. Order your size, pay into escrow and confirm when they fit." },
  { id: "post_16", authorKey: "u_19", hoursAgo: 80, photoKey: "laptopDesk", engagement: [430, 67, 12, 5_200], text: "New workspace setup. Plants, good light, and a laptop stand that saved my neck. What does your desk look like?" },
  { id: "post_17", authorKey: "u_13", hoursAgo: 86, productKeys: ["b4", "b6"], engagement: [8920, 1204, 310, 142_000], likedByFriends: ["u_3", "u_10", "u_15"], text: "GRWM for date night 💄 Using the lip oil duo and the matte foundation from @glowbyzainab — both linked here. Shade Cocoa 420 is my perfect match 🥰" },
  { id: "post_18", authorKey: "u_21", hoursAgo: 92, photoKey: "graduation", engagement: [2640, 480, 58, 28_300], text: "My baby sister is officially a lawyer! 🎓⚖️ Called to the bar today. Nigerian parents, you can finally rest 😂" },
  { id: "post_19", authorKey: "u_16", hoursAgo: 100, photoKey: "streetMarket", engagement: [590, 44, 20, 8_100], text: "Kurmi market in Kano today. The colours, the spices, the noise — nothing beats it." },
  { id: "post_20", authorKey: "u_2", hoursAgo: 110, productKeys: ["g7", "g5"], engagement: [690, 92, 25, 10_900], text: "For the devs and writers 👨🏾‍💻 75% hot-swap mechanical keyboard + aluminium laptop stand. Only 3 keyboards left in this batch." },
  { id: "post_21", authorKey: "u_17", hoursAgo: 120, photoKey: "plantsBalcony", engagement: [260, 31, 5, 2_800], text: "My balcony jungle is thriving 🌿 Who knew Port Harcourt rain was the secret?" },
  { id: "post_22", authorKey: "u_18", hoursAgo: 130, engagement: [1340, 211, 95, 18_400], text: "New song drops Friday. Afrobeats x highlife. I've been sitting on this one for a year 🎹🔥" },
  { id: "post_23", authorKey: "u_1", hoursAgo: 140, productKeys: ["f4", "f6"], engagement: [1520, 170, 44, 21_700], text: "Complete the look 👑 Aso-Oke gele in gold, rose gold and emerald, plus beaded statement necklaces. December weddings, we're ready." },
  { id: "post_24", authorKey: "u_20", hoursAgo: 150, photoKey: "familyDinner", engagement: [480, 62, 8, 6_000], likedByFriends: ["u_7"], text: "Sunday rice with the whole family. Mum still thinks I'm 10 and dished my food for me 😂 No complaints." },
  { id: "post_25", authorKey: "u_22", hoursAgo: 160, photoKey: "rainyDay", engagement: [720, 148, 39, 9_300], text: "Lagos rain + Third Mainland Bridge = 3 hours in traffic. Send help and suya." },
  { id: "post_26", authorKey: "u_me", hoursAgo: 170, productKeys: ["h3", "h5", "h7"], engagement: [410, 38, 11, 6_700], text: "Cosy corner goals ☕ Speckled mugs, Adire cushion covers and seagrass baskets — all handmade in Nigeria." },
  { id: "post_27", authorKey: "u_9", hoursAgo: 180, photoKey: "cameraGear", engagement: [640, 99, 14, 8_800], text: "Gear check for this weekend's shoot 📷 What should I add to the bag?" },
  { id: "post_28", authorKey: "u_23", hoursAgo: 190, engagement: [980, 120, 17, 11_200], text: "Six cakes delivered today and not one fell in traffic 🙌🏾 Owerri drivers, I salute you." },
  { id: "post_29", authorKey: "u_15", hoursAgo: 200, photoKey: "airportTravel", engagement: [770, 91, 23, 10_100], text: "Off to Calabar for the Carnival! Who else is going? ✈️🎉" },
  { id: "post_31", authorKey: "u_7", hoursAgo: 15, engagement: [356, 47, 33, 8_900], text: "Good read on how Nigerian fintechs are handling the new CBN rules https://techcabal.com/2026/10/02/fintech-compliance-guide/", linkPreview: { url: "https://techcabal.com/2026/10/02/fintech-compliance-guide/", domain: "techcabal.com", title: "How Nigerian fintechs are adapting to the new CBN rules", description: "Founders and compliance leads explain what changes for wallets, KYC tiers and cross-border payments this quarter.", siteName: "TechCabal", imageUrl: postImageUrlsForPhotoKey("laptopDesk")[0] ?? null, imageMediaId: null } },
  { id: "post_32", authorKey: "u_10", hoursAgo: 18, engagement: [212, 19, 8, 4_100], text: "This dress is everything for December 😍 https://app.zudomart.com/p/ankara-wrap-midi-dress-pr_f1" },
  { id: "post_30", authorKey: "u_3", hoursAgo: 210, productKeys: ["b5"], engagement: [1190, 205, 60, 16_400], text: "Edges gone? 😅 Chebe & rosemary oil is back — only 2 bottles left in this batch." },
];

const SPONSORED_POST_SEEDS: readonly PostSeed[] = [
  { id: "ad_post_1", authorKey: "u_2", hoursAgo: 4, productKeys: ["g3"], engagement: [540, 36, 12, 88_000], text: "Track your steps, sleep and heart rate — and never miss a WhatsApp message. Smartwatch Series 5, delivered tomorrow in Lagos." },
  { id: "ad_post_2", authorKey: "u_3", hoursAgo: 8, productKeys: ["b3"], engagement: [760, 52, 19, 104_000], text: "Dark spots? Our 15% Vitamin C serum fades them in 4–6 weeks. 15% off this week only ✨" },
  { id: "ad_post_3", authorKey: "u_6", hoursAgo: 15, productKeys: ["s5"], engagement: [310, 18, 6, 61_000], text: "Early-morning runs just got lighter. Breathable knit trainers in sizes UK 7–12." },
  { id: "ad_post_4", authorKey: "u_1", hoursAgo: 22, productKeys: ["f1"], engagement: [920, 64, 28, 97_000], text: "The wrap dress everyone keeps asking about is back in 3 prints. Pay into escrow, release when it fits 💃🏾" },
];

const collectPostMedia = (seed: PostSeed): Media[] => {
  const urls = seed.productKeys?.length
    ? seed.productKeys.flatMap((key) => productImageUrlsForProduct(key))
    : seed.photoKey
      ? postImageUrlsForPhotoKey(seed.photoKey)
      : [];
  return urls.slice(0, MAXIMUM_IMAGES_PER_POST).map((url) => ({ type: "image" as const, url }));
};

function buildPostFromSeed(seed: PostSeed, sponsored = false): Post {
  const [likes, comments, reposts, views] = seed.engagement;
  const firstProductSeed = seed.productKeys?.[0] ? catalogProductSeeds.find((product) => product.key === seed.productKeys![0]) : undefined;
  return {
    id: seed.id,
    kind: "post",
    author: userSummaryById(seed.authorKey),
    createdAt: isoDateHoursAgo(seed.hoursAgo),
    text: seed.text,
    media: collectPostMedia(seed),
    likes,
    comments,
    reposts,
    views,
    liked: false,
    bookmarked: false,
    saveCount: 0,
    isFollowingAuthor: isFollowingUser(seed.authorKey),
    friendsLiked: seed.likedByFriends ? buildFriendsLikedFromFollowedUsers(seed.likedByFriends, seed.likedByFriends.length + (likes % 17)) : null,
    products: (seed.productKeys ?? []).map((key) => productSummaryByKey(key)),
    sponsored: sponsored && firstProductSeed ? buildSponsoredPlacementForSeed(firstProductSeed) : null,
    linkPreview: seed.linkPreview ?? null,
  };
}

export const mockPostsState = new Map<string, Post>(POST_SEEDS.map((seed) => [seed.id, buildPostFromSeed(seed)]));

const singleSponsoredFeedPosts: readonly Post[] = SPONSORED_POST_SEEDS.map((seed) => buildPostFromSeed(seed, true));
export const sponsoredFeedPosts: readonly Post[] = [...singleSponsoredFeedPosts, ...buildRichSponsoredPosts(singleSponsoredFeedPosts)];

export const listPostsByAuthor = (authorId: string) => [...mockPostsState.values()].filter((post) => post.author.id === authorId);

export const withCurrentProductPrices = (post: Post): Post => ({
  ...post,
  bookmarked: isTargetSavedByViewer("post", post.id),
  products: post.products.map((product) => {
    const seed = findCatalogSeedByProductId(product.id);
    return seed ? { ...buildCatalogProductSummary(seed), sponsored: product.sponsored ?? null } : product;
  }),
});

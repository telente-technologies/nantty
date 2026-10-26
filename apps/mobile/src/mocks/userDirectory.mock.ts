import type { User, UserSummary, Verification } from "@/types";

import { avatarImageUrlForUser, buildUnsplashImageUrl, coverImageUrlForUser, type DirectoryUserKey } from "./mockImages.mock";
import { findActiveLiveForHost } from "./activeLives.mock";
import { unsplashPhotoIds } from "./unsplashPhotoIds.mock";

export type DirectoryUserId = DirectoryUserKey | "u_gov";

const verification = (color: Verification["color"], tier: Verification["tier"]): Verification => ({
  status: "active",
  type: color === "blue" ? "personal" : color === "gold" ? "business" : "government",
  color,
  tier,
  badgeVisible: tier !== "ESSENTIAL",
});

interface DirectoryUserSeed {
  readonly key: DirectoryUserId;
  readonly name: string;
  readonly username: string;
  readonly bio: string;
  readonly followers: number;
  readonly following: number;
  readonly posts: number;
  readonly joinedAt: string;
  readonly storeId?: string;
  readonly verification?: Verification;
}

const VERIFICATION_BY_USER_ID: Partial<Record<DirectoryUserId, Verification>> = {
  u_me: verification("blue", "VERIFIED"),
  u_1: verification("blue", "PREMIUM"),
  u_2: verification("blue", "VERIFIED"),
  u_3: verification("blue", "VERIFIED"),
  u_6: verification("blue", "VERIFIED"),
  u_9: verification("blue", "VERIFIED"),
  u_10: verification("blue", "VERIFIED"),
  u_12: verification("blue", "VERIFIED"),
  u_13: verification("blue", "PREMIUM"),
  u_15: verification("blue", "ESSENTIAL"),
  u_25: verification("blue", "PREMIUM"),
  u_gov: verification("black", "OFFICIAL"),
};

const DIRECTORY_USER_SEEDS: readonly DirectoryUserSeed[] = [
  { key: "u_me", name: "Temitope Adeyemi", username: "temi.homes", bio: "Making Nigerian homes warmer, one clay pot at a time 🏺 Ibadan • Ships nationwide", followers: 6840, following: 412, posts: 138, joinedAt: "2025-03-14T00:00:00.000Z", storeId: "s_home" },
  { key: "u_buyer", name: "Kemi Adekunle", username: "kemi.adekunle", bio: "Pharmacist by day, online window-shopper by night 🛍️ Lagos", followers: 318, following: 540, posts: 21, joinedAt: "2025-11-02T00:00:00.000Z" },
  { key: "u_1", name: "Adaeze Okafor", username: "adaeze.styles", bio: "Ankara & Adire pieces made in Lekki. Custom orders open 🧵 DM for measurements", followers: 48200, following: 610, posts: 912, joinedAt: "2024-06-01T00:00:00.000Z", storeId: "s_ada" },
  { key: "u_2", name: "Tunde Bakare", username: "tundetech", bio: "Original gadgets, honest prices. Computer Village, Ikeja 📱 1-year warranty on everything", followers: 31500, following: 288, posts: 604, joinedAt: "2024-08-19T00:00:00.000Z", storeId: "s_tunde" },
  { key: "u_3", name: "Zainab Bello", username: "glowbyzainab", bio: "Clean skincare for melanin-rich skin ✨ Abuja • Formulated with shea & black soap", followers: 27800, following: 950, posts: 540, joinedAt: "2024-10-07T00:00:00.000Z", storeId: "s_glow" },
  { key: "u_4", name: "Nkechi Obi", username: "mamankechi.foods", bio: "Mama's kitchen, your table 🍲 Ofada, spices & snacks from Enugu to your door", followers: 9400, following: 120, posts: 233, joinedAt: "2025-01-22T00:00:00.000Z", storeId: "s_food" },
  { key: "u_5", name: "Folake Adebayo", username: "littlekingsng", bio: "Mum of 3 👑 Cute, safe & durable things for little kings and queens", followers: 12600, following: 380, posts: 301, joinedAt: "2025-02-10T00:00:00.000Z", storeId: "s_kids" },
  { key: "u_6", name: "Emeka Nwosu", username: "kicksbyemeka", bio: "Handmade leather from Aba + clean sneakers 👞 Pay on escrow, walk with confidence", followers: 18900, following: 402, posts: 477, joinedAt: "2024-12-03T00:00:00.000Z", storeId: "s_kicks" },
  { key: "u_7", name: "Chinedu Okeke", username: "chinedu.codes", bio: "Software engineer • building for Africa • Arsenal till I die", followers: 2210, following: 689, posts: 164, joinedAt: "2025-04-11T00:00:00.000Z" },
  { key: "u_8", name: "Aisha Mohammed", username: "aishamoh", bio: "Kano ➡️ Lagos. Sunsets, abaya fits and good tea.", followers: 1540, following: 802, posts: 97, joinedAt: "2025-05-26T00:00:00.000Z" },
  { key: "u_9", name: "Kelechi Eze", username: "kelechi_ez", bio: "Photographer 📷 Weddings, portraits & the streets of Lagos", followers: 8730, following: 510, posts: 689, joinedAt: "2024-09-15T00:00:00.000Z" },
  { key: "u_10", name: "Bisola Ogunleye", username: "bisola.eats", bio: "I eat, I rate, I tell you where 🍛 Lagos food diary", followers: 15300, following: 740, posts: 820, joinedAt: "2024-07-30T00:00:00.000Z" },
  { key: "u_11", name: "Ifeoma Nwankwo", username: "ifeoma.reads", bio: "Books, coffee and slow Sundays 📚 Currently reading Chimamanda again", followers: 930, following: 410, posts: 58, joinedAt: "2025-06-18T00:00:00.000Z" },
  { key: "u_12", name: "Segun Afolabi", username: "segunfitness", bio: "Coach Segun 💪 Home workouts that actually fit a Lagos schedule", followers: 21400, following: 330, posts: 715, joinedAt: "2024-11-09T00:00:00.000Z" },
  { key: "u_13", name: "Amaka Chukwu", username: "amakachukwu", bio: "Content creator • brand partnerships via DM 🎥 Go live with me every Friday!", followers: 124000, following: 890, posts: 1406, joinedAt: "2024-05-02T00:00:00.000Z" },
  { key: "u_14", name: "Olumide Johnson", username: "olumide.j", bio: "Banker. Super Eagles fan. Suya connoisseur.", followers: 760, following: 612, posts: 44, joinedAt: "2025-07-08T00:00:00.000Z" },
  { key: "u_15", name: "Funmilayo Adewale", username: "funmi.travels", bio: "33 states down, 3 to go 🇳🇬 Travel tips + where to stay on a budget", followers: 11200, following: 870, posts: 402, joinedAt: "2024-12-20T00:00:00.000Z" },
  { key: "u_16", name: "Yusuf Garba", username: "yusufgarba", bio: "Agric-tech in Kaduna 🌾 Farming is the future", followers: 1980, following: 305, posts: 88, joinedAt: "2025-03-29T00:00:00.000Z" },
  { key: "u_17", name: "Ngozi Okonkwo", username: "ngozi.okonkwo", bio: "Nurse, wife, plant mum 🌿 Port Harcourt", followers: 640, following: 470, posts: 39, joinedAt: "2025-08-12T00:00:00.000Z" },
  { key: "u_18", name: "Damilola Ojo", username: "dami.ojo", bio: "Afrobeats producer 🎹 New EP loading", followers: 5600, following: 600, posts: 210, joinedAt: "2025-01-05T00:00:00.000Z" },
  { key: "u_19", name: "Hauwa Musa", username: "hauwa.designs", bio: "Product designer • I notice fonts on danfo buses", followers: 3120, following: 720, posts: 150, joinedAt: "2025-02-27T00:00:00.000Z" },
  { key: "u_20", name: "Obinna Uche", username: "obinna.uche", bio: "Civil engineer. Weekend chef. Enugu boy in Abuja.", followers: 890, following: 530, posts: 61, joinedAt: "2025-05-03T00:00:00.000Z" },
  { key: "u_21", name: "Blessing Etim", username: "blessing.etim", bio: "Calabar girl 💃 Event planner — weddings, birthdays, owambes", followers: 4380, following: 910, posts: 276, joinedAt: "2024-10-28T00:00:00.000Z" },
  { key: "u_22", name: "Gbenga Alabi", username: "gbenga.alabi", bio: "Car guy 🚗 Lagos–Ibadan expressway survivor", followers: 1270, following: 390, posts: 72, joinedAt: "2025-04-30T00:00:00.000Z" },
  { key: "u_23", name: "Chioma Obi", username: "chioma.bakes", bio: "Cakes that taste as good as they look 🎂 Orders in Owerri", followers: 7050, following: 640, posts: 355, joinedAt: "2024-09-01T00:00:00.000Z" },
  { key: "u_24", name: "Ibrahim Sani", username: "ibrahim.sani", bio: "Hiking Obudu one step at a time ⛰️", followers: 1430, following: 280, posts: 96, joinedAt: "2025-06-02T00:00:00.000Z" },
  { key: "u_gov", name: "Demo State Ministry of Trade", username: "demostatetrade", bio: "Fictional demo government account. Consumer-protection tips for online shoppers and small businesses.", followers: 88400, following: 3, posts: 61, joinedAt: "2024-09-09T00:00:00.000Z" },
  { key: "u_25", name: "Nantty Support", username: "zudomart", bio: "Official help desk. We never ask for your password or card PIN.", followers: 58200, following: 12, posts: 140, joinedAt: "2024-04-01T00:00:00.000Z" },
];

export const SUSPENDED_USER_IDS: ReadonlySet<string> = new Set(["u_16", "u_22"]);

const CREATOR_USER_IDS = new Set<DirectoryUserId>(["u_me", "u_9", "u_10", "u_12", "u_13", "u_18"]);

const avatarForSeed = (key: DirectoryUserId) =>
  key === "u_gov" ? buildUnsplashImageUrl(unsplashPhotoIds.posts.lagosSkyline[1] ?? unsplashPhotoIds.posts.lagosSkyline[0], 200) : avatarImageUrlForUser(key);
const coverForSeed = (key: DirectoryUserId) =>
  key === "u_gov" ? buildUnsplashImageUrl(unsplashPhotoIds.posts.lagosSkyline[0], 1200) : coverImageUrlForUser(key);

const buildUserFromSeed = (seed: DirectoryUserSeed): User => ({
  id: seed.key,
  account: { status: SUSPENDED_USER_IDS.has(seed.key) ? "suspended" : "active" },
  name: seed.name,
  username: seed.username,
  avatarUrl: avatarForSeed(seed.key),
  bannerUrl: coverForSeed(seed.key),
  verified: VERIFICATION_BY_USER_ID[seed.key]?.badgeVisible ?? false,
  verification: VERIFICATION_BY_USER_ID[seed.key] ?? null,
  isCreator: CREATOR_USER_IDS.has(seed.key),
  bio: seed.bio,
  followers: seed.followers,
  following: seed.following,
  posts: seed.posts,
  joinedAt: seed.joinedAt,
  isSeller: !!seed.storeId,
  storeId: seed.storeId ?? null,
});

export const directoryUsers: readonly User[] = DIRECTORY_USER_SEEDS.map(buildUserFromSeed);

export const directoryUsersExcludingAccounts = directoryUsers.filter((user) => user.id !== "u_me" && user.id !== "u_buyer" && user.account?.status === "active");

export const findDirectoryUserById = (userId: string): User | undefined => directoryUsers.find((user) => user.id === userId);

export const summariseUser = (user: User): UserSummary => ({
  id: user.id,
  account: user.account ?? { status: "active" },
  name: user.name,
  username: user.username,
  avatarUrl: user.avatarUrl,
  verified: user.verified,
  verification: user.verification ?? null,
  isCreator: user.isCreator ?? false,
  live: findActiveLiveForHost(user.id),
});

export const userSummaryById = (userId: DirectoryUserId): UserSummary => summariseUser(findDirectoryUserById(userId)!);

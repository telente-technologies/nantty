import { buildUnsplashImageUrl, unsplashPhotoIds } from "@/mocks/seed/unsplashPhotoIds.mock";
import type { PlatformUserPersonalData, PlatformUserSummary, UserVerificationSummary } from "@/types/platformUser.type";

export interface MockPlatformUserRecord extends Omit<PlatformUserSummary, "emailMasked" | "phoneMasked"> {
  readonly personalData: PlatformUserPersonalData;
}

type AvatarKey = keyof typeof unsplashPhotoIds.avatars;

const countryCurrency: Record<string, string> = { NG: "NGN", GH: "GHS", KE: "KES", ZA: "ZAR", GB: "GBP", US: "USD" };

const blue = (tier: "ESSENTIAL" | "VERIFIED" | "PREMIUM", status: UserVerificationSummary["status"] = "VERIFIED"): UserVerificationSummary => ({ color: "BLUE", tier, status, badgeVisible: status === "VERIFIED" && tier !== "ESSENTIAL" });
const gold = (tier: "PRO" | "PREMIUM", status: UserVerificationSummary["status"] = "VERIFIED"): UserVerificationSummary => ({ color: "GOLD", tier, status, badgeVisible: status === "VERIFIED" });
const black = (): UserVerificationSummary => ({ color: "BLACK", tier: "OFFICIAL", status: "VERIFIED", badgeVisible: true });

interface SeedRow {
  readonly username: string;
  readonly displayName: string;
  readonly legalName: string;
  readonly country: string;
  readonly avatar: AvatarKey | null;
  readonly status?: PlatformUserSummary["status"];
  readonly verification?: UserVerificationSummary | null;
  readonly seller?: boolean;
  readonly creator?: boolean;
  readonly followers: number;
  readonly strikes?: number;
  readonly risk?: PlatformUserSummary["riskLevel"];
  readonly joinedDaysAgo: number;
}

const seedRows: readonly SeedRow[] = [
  { username: "adaeze.styles", displayName: "Adaeze Styles", legalName: "Adaeze Nnamdi Okonkwo", country: "NG", avatar: "u_1", verification: gold("PRO"), seller: true, creator: true, followers: 184_200, joinedDaysAgo: 610 },
  { username: "tunde_eats", displayName: "Tunde Eats", legalName: "Babatunde Olalekan Bakare", country: "NG", avatar: "u_2", verification: blue("PREMIUM"), creator: true, followers: 92_410, joinedDaysAgo: 540 },
  { username: "kemi.kitchen", displayName: "Kemi's Kitchen", legalName: "Oluwakemi Adebayo", country: "NG", avatar: "u_3", verification: gold("PREMIUM"), seller: true, followers: 41_870, joinedDaysAgo: 480 },
  { username: "chioma_threads", displayName: "Chioma Threads", legalName: "Chioma Blessing Eze", country: "NG", avatar: "u_4", verification: gold("PRO", "PENDING"), seller: true, followers: 12_300, joinedDaysAgo: 210 },
  { username: "emeka.gadgets", displayName: "Emeka Gadgets", legalName: "Chukwuemeka Obi", country: "NG", avatar: "u_5", seller: true, followers: 8_940, strikes: 2, risk: "MEDIUM", status: "WARNED", joinedDaysAgo: 330 },
  { username: "zainab.glow", displayName: "Zainab Glow", legalName: "Zainab Aminu Bello", country: "NG", avatar: "u_6", verification: blue("VERIFIED"), creator: true, followers: 67_020, joinedDaysAgo: 400 },
  { username: "kwame.beats", displayName: "Kwame Beats", legalName: "Kwame Mensah Asante", country: "GH", avatar: "u_7", verification: blue("VERIFIED"), creator: true, followers: 55_300, joinedDaysAgo: 260 },
  { username: "wanjiru.home", displayName: "Wanjiru Home", legalName: "Wanjiru Kamau", country: "KE", avatar: "u_8", seller: true, followers: 6_110, joinedDaysAgo: 150 },
  { username: "sipho.fits", displayName: "Sipho Fits", legalName: "Sipho Ndlovu", country: "ZA", avatar: "u_9", verification: blue("ESSENTIAL"), followers: 3_480, joinedDaysAgo: 95 },
  { username: "lagosstate.gov", displayName: "Lagos State Government", legalName: "Lagos State Government", country: "NG", avatar: null, verification: black(), followers: 1_204_000, joinedDaysAgo: 700 },
  { username: "ifeoma.art", displayName: "Ifeoma Art", legalName: "Ifeoma Grace Uche", country: "NG", avatar: "u_10", creator: true, followers: 22_050, joinedDaysAgo: 190 },
  { username: "dayo_deals", displayName: "Dayo Deals", legalName: "Adedayo Akinola", country: "NG", avatar: "u_11", seller: true, status: "SUSPENDED", strikes: 3, risk: "HIGH", followers: 2_310, joinedDaysAgo: 120 },
  { username: "funke.naturals", displayName: "Funke Naturals", legalName: "Olufunke Adeyemi", country: "NG", avatar: "u_12", verification: gold("PRO"), seller: true, followers: 31_500, joinedDaysAgo: 520 },
  { username: "musa.motors", displayName: "Musa Motors", legalName: "Musa Ibrahim Danjuma", country: "NG", avatar: "u_13", seller: true, followers: 4_020, joinedDaysAgo: 60 },
  { username: "amara.reads", displayName: "Amara Reads", legalName: "Amarachi Nwosu", country: "NG", avatar: "u_14", verification: blue("VERIFIED", "PENDING"), creator: true, followers: 18_900, joinedDaysAgo: 240 },
  { username: "bolu.films", displayName: "Bolu Films", legalName: "Boluwatife Ogunleye", country: "NG", avatar: "u_15", creator: true, followers: 39_700, strikes: 1, joinedDaysAgo: 310 },
  { username: "nana.ama.shop", displayName: "Nana Ama Shop", legalName: "Nana Ama Owusu", country: "GH", avatar: "u_16", seller: true, followers: 9_870, joinedDaysAgo: 180 },
  { username: "segun.snaps", displayName: "Segun Snaps", legalName: "Olusegun Fashola", country: "NG", avatar: "u_17", followers: 1_240, joinedDaysAgo: 45 },
  { username: "halima.hijabs", displayName: "Halima Hijabs", legalName: "Halima Sadiq", country: "NG", avatar: "u_18", seller: true, verification: gold("PRO", "PENDING"), followers: 14_600, joinedDaysAgo: 220 },
  { username: "fake.dangote.official", displayName: "Dangote Official Giveaway", legalName: "Unknown", country: "NG", avatar: null, status: "BANNED", strikes: 4, risk: "HIGH", followers: 310, joinedDaysAgo: 12 },
  { username: "obinna.tech", displayName: "Obinna Tech", legalName: "Obinna Chukwu", country: "NG", avatar: "u_19", verification: blue("PREMIUM"), followers: 27_300, joinedDaysAgo: 450 },
  { username: "tomi.travels", displayName: "Tomi Travels", legalName: "Oluwatomisin Ajayi", country: "GB", avatar: "u_20", creator: true, followers: 48_200, joinedDaysAgo: 370 },
  { username: "jide.kicks", displayName: "Jide Kicks", legalName: "Babajide Salako", country: "NG", avatar: "u_21", seller: true, followers: 11_050, strikes: 1, risk: "MEDIUM", joinedDaysAgo: 140 },
  { username: "ngozi_bakes", displayName: "Ngozi Bakes", legalName: "Ngozi Okafor", country: "NG", avatar: "u_22", seller: true, followers: 5_600, joinedDaysAgo: 88 },
  { username: "yemi.sound", displayName: "Yemi Sound", legalName: "Oluwayemi Afolabi", country: "NG", avatar: "u_23", verification: blue("VERIFIED"), creator: true, followers: 73_900, joinedDaysAgo: 600 },
  { username: "grace.decor", displayName: "Grace Decor", legalName: "Grace Etim", country: "NG", avatar: "u_24", seller: true, followers: 2_870, joinedDaysAgo: 30 },
  { username: "ken.otieno", displayName: "Ken Otieno", legalName: "Kennedy Otieno", country: "KE", avatar: "u_25", followers: 640, joinedDaysAgo: 20 },
  { username: "mide.mua", displayName: "Mide MUA", legalName: "Ayomide Coker", country: "NG", avatar: "u_me", creator: true, verification: blue("ESSENTIAL"), followers: 15_200, joinedDaysAgo: 160 },
];

function buildEmailForRow(row: SeedRow): string {
  return `${row.username.replace(/[._]/g, "")}@${row.country === "NG" ? "gmail.com" : "outlook.com"}`;
}

function buildPhoneForRow(row: SeedRow, index: number): string {
  const prefixes: Record<string, string> = { NG: "+234 803", GH: "+233 24", KE: "+254 712", ZA: "+27 82", GB: "+44 7700", US: "+1 415" };
  return `${prefixes[row.country] ?? "+1 415"} ${String(4_102_000 + index * 7_919).slice(0, 3)} ${String(1000 + index * 37).slice(0, 4)}`;
}

export function buildDemoPlatformUsers(): MockPlatformUserRecord[] {
  const now = Date.now();
  return seedRows.map((row, index) => ({
    id: `usr_${String(index + 1).padStart(4, "0")}`,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatar ? buildUnsplashImageUrl(unsplashPhotoIds.avatars[row.avatar], 160) : null,
    country: row.country,
    currency: countryCurrency[row.country] ?? "USD",
    status: row.status ?? "ACTIVE",
    verification: row.verification ?? null,
    isSeller: row.seller ?? false,
    isCreator: row.creator ?? false,
    followerCount: row.followers,
    joinedAt: new Date(now - row.joinedDaysAgo * 86_400_000).toISOString(),
    lastActiveAt: new Date(now - ((index * 53) % 1440) * 60_000).toISOString(),
    strikeCount: row.strikes ?? 0,
    riskLevel: row.risk ?? "LOW",
    personalData: { email: buildEmailForRow(row), phone: buildPhoneForRow(row, index), legalName: row.legalName, dateOfBirth: `19${80 + (index % 19)}-0${1 + (index % 9)}-1${index % 10}` },
  }));
}

export function maskEmailAddress(email: string): string {
  const [localPart = "", domain = ""] = email.split("@");
  return `${localPart.slice(0, 2)}${"•".repeat(Math.max(localPart.length - 2, 3))}@${domain}`;
}

export function maskPhoneNumber(phone: string): string {
  return `${phone.slice(0, 5)} ••• •• ${phone.slice(-2)}`;
}

export function presentPlatformUserSummary(record: MockPlatformUserRecord): PlatformUserSummary {
  const { personalData, ...summary } = record;
  return { ...summary, emailMasked: maskEmailAddress(personalData.email), phoneMasked: maskPhoneNumber(personalData.phone) };
}

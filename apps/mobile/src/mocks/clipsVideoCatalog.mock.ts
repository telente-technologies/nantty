import type { CatalogProductKey, DirectoryUserKey } from "./mockImages.mock";

type ClipAuthorKey = Extract<DirectoryUserKey, string>;

export interface ClipVideoSeed {
  readonly id: string;
  readonly authorId: ClipAuthorKey;
  readonly caption: string;
  readonly videoUrl: string;
  readonly posterUrl: string;
  readonly hlsUrl?: string;
  readonly sourcePageUrl: string;
  readonly width: number;
  readonly height: number;
  readonly durationSeconds: number;
  readonly hoursAgo: number;
  readonly likes: number;
  readonly comments: number;
  readonly views: number;
  readonly friendIdsWhoLiked?: readonly ClipAuthorKey[];
  readonly sponsoredCampaign?: { readonly campaignId: string; readonly advertiserName: string; readonly ctaLabel: string; readonly ctaUrl: string };
  readonly taggedProductKeys?: readonly CatalogProductKey[];
}

export const MIXKIT_LICENSE = "Mixkit Stock Video Free License (https://mixkit.co/license/#videoFree)";
export const BIG_BUCK_BUNNY_LICENSE = "Creative Commons Attribution 3.0 — Big Buck Bunny (c) Blender Foundation, peach.blender.org";
export const MUX_TEST_HLS_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

const mixkitVideo = (videoId: number, slug: string) => ({
  videoUrl: `https://assets.mixkit.co/videos/${videoId}/${videoId}-720.mp4`,
  posterUrl: `https://assets.mixkit.co/videos/${videoId}/${videoId}-thumb-720-0.jpg`,
  sourcePageUrl: `https://mixkit.co/free-stock-video/${slug}-${videoId}/`,
  width: 720,
  height: 1280,
});

export const clipVideoSeeds: readonly ClipVideoSeed[] = [
  {
    id: "clip_amaka_haul",
    authorId: "u_13",
    caption: "POV: you finally found the exact Ankara set from my last video on Nantty 😭🛍️ Store tab has everything #NanttyFinds #LagosShopping",
    ...mixkitVideo(42136, "woman-exploring-an-online-sales-page-on-her-cell-phone"),
    durationSeconds: 10, hoursAgo: 2, likes: 48_300, comments: 1_240, views: 612_000,
  },
  {
    id: "clip_adaeze_packing",
    authorId: "u_1",
    caption: "Packing today's orders for Abuja, PH and Enugu 📦 Thank you for trusting a small Lekki brand ❤️ #SmallBusinessNG #Ankara",
    ...mixkitVideo(42137, "hands-of-two-people-sealing-a-package-with-tape"),
    durationSeconds: 14, hoursAgo: 5, likes: 11_200, comments: 386, views: 94_500,
    friendIdsWhoLiked: ["u_3", "u_9", "u_13"],
    taggedProductKeys: ["f1", "f2"],
  },
  {
    id: "clip_aisha_fitcheck",
    authorId: "u_8",
    caption: "Sunday fit check before brunch in Ikoyi ✨ abaya but make it street #FitCheck #LagosBabe",
    ...mixkitVideo(44542, "stylish-woman-sitting-in-a-sports-car"),
    durationSeconds: 12, hoursAgo: 7, likes: 3_870, comments: 142, views: 28_900,
  },
  {
    id: "clip_kelechi_bts",
    authorId: "u_9",
    caption: "Behind the scenes from today's studio shoot in Yaba 📸 December wedding bookings are open, don't wait till November #LagosPhotographer",
    ...mixkitVideo(34427, "young-female-model-posing-in-a-photoshoot"),
    durationSeconds: 12, hoursAgo: 9, likes: 6_540, comments: 203, views: 51_300,
  },
  {
    id: "clip_zainab_bridal",
    authorId: "u_3",
    caption: "Bridal glam with our Matte Finish Foundation 💄 12 hours, zero melting in Lagos heat 💯 #BridalGlam #MelaninBeauty",
    ...mixkitVideo(40556, "makeup-artist-powdering-a-bride"),
    durationSeconds: 12, hoursAgo: 11, likes: 22_900, comments: 918, views: 301_000,
    sponsoredCampaign: { campaignId: "cmp_clip_glow_bridal", advertiserName: "Glow by Zainab", ctaLabel: "Shop now", ctaUrl: "https://nantty.com/stores/s_glow" },
    taggedProductKeys: ["b6"],
  },
  {
    id: "clip_blessing_wedding",
    authorId: "u_21",
    caption: "Our bride said YES to the garden reception 🌸 Calabar weddings hit different #OwambeSeason #NaijaWedding",
    ...mixkitVideo(40602, "portrait-of-a-happy-bride-in-the-garden"),
    durationSeconds: 17, hoursAgo: 14, likes: 9_120, comments: 457, views: 77_800,
    friendIdsWhoLiked: ["u_1", "u_10"],
  },
  {
    id: "clip_olumide_barber",
    authorId: "u_14",
    caption: "My barber in Surulere no dey miss 💈 fresh cut for the weekend #BarberNG #Surulere",
    ...mixkitVideo(40128, "barber-passing-the-cutting-machine-over-the-neck-of-a"),
    durationSeconds: 9, hoursAgo: 18, likes: 1_430, comments: 64, views: 12_700,
  },
  {
    id: "clip_chinedu_lowcut",
    authorId: "u_7",
    caption: "Low cut before demo day. Engineers need to look sharp too 😅 #TechLife #BuildingForAfrica",
    ...mixkitVideo(43243, "close-up-of-a-man-getting-a-haircut"),
    durationSeconds: 12, hoursAgo: 21, likes: 2_080, comments: 97, views: 19_400,
  },
  {
    id: "clip_nkechi_zobo",
    authorId: "u_4",
    caption: "Chilled zobo with fresh oranges 🍊 perfect for this Enugu heat. Dried zobo leaves are in my store! #Zobo #NaijaDrinks",
    ...mixkitVideo(10428, "serving-juice-in-a-glass-with-some-oranges-on-a"),
    durationSeconds: 15, hoursAgo: 26, likes: 5_760, comments: 231, views: 44_100,
    taggedProductKeys: ["fd7"],
  },
  {
    id: "clip_bisola_jollof",
    authorId: "u_10",
    caption: "Party jollof part 1: it all starts with the right tomatoes 🍅 Part 2 drops tomorrow #JollofRice #NaijaFood",
    ...mixkitVideo(40534, "a-man-slices-a-tomato"),
    durationSeconds: 13, hoursAgo: 30, likes: 17_400, comments: 1_090, views: 188_000,
    friendIdsWhoLiked: ["u_7", "u_12", "u_15"],
  },
  {
    id: "clip_tunde_earbuds",
    authorId: "u_2",
    caption: "Wireless Earbuds Pro are back in stock at Computer Village 🎧 1-year warranty, pay on escrow #Gadgets #ComputerVillage",
    ...mixkitVideo(41174, "happy-man-texting-on-his-smartphone"),
    durationSeconds: 7, hoursAgo: 33, likes: 8_310, comments: 402, views: 120_500,
    sponsoredCampaign: { campaignId: "cmp_clip_tunde_earbuds", advertiserName: "TundeTech Gadgets", ctaLabel: "Buy now", ctaUrl: "https://nantty.com/stores/s_tunde" },
    taggedProductKeys: ["g1"],
  },
  {
    id: "clip_hauwa_dms",
    authorId: "u_19",
    caption: "Replying to client DMs between Figma files 😂 designer life in Abuja #DesignLife #Abuja",
    ...mixkitVideo(43270, "woman-typing-on-her-cell-phone"),
    durationSeconds: 8, hoursAgo: 40, likes: 2_640, comments: 118, views: 21_900,
  },
  {
    id: "clip_dami_break",
    authorId: "u_18",
    caption: "Studio break while the beat renders 🎹🐰 Sunday cartoon throwback #StudioBreak #Animation",
    videoUrl: MUX_TEST_HLS_URL,
    posterUrl: "https://peach.blender.org/wp-content/uploads/bbb-splash.png",
    hlsUrl: MUX_TEST_HLS_URL,
    sourcePageUrl: "https://peach.blender.org/about/",
    width: 1280,
    height: 720,
    durationSeconds: 596, hoursAgo: 46, likes: 940, comments: 37, views: 8_300,
  },
];

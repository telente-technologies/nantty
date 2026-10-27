import type { LandingIconName } from "./landingIcons";

export const nanttyMainSiteUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://nantty.com";

export const landingNavigationLinks = [
  { href: "#go-live", label: "Go live" },
  { href: "#features", label: "Features" },
  { href: "#earnings", label: "Earnings" },
  { href: "#creator-program", label: "Creator Program" },
  { href: "#faq", label: "FAQ" },
] as const;

export const landingTickerItems = [
  "Go live from your phone",
  "OBS, WHIP and RTMP",
  "Up to 10 creators on stage",
  "Battles with winner takes all",
  "Gift combos and gift goals",
  "Keep 80% of fan subscriptions",
  "Payouts to your bank",
  "Overlays and scenes",
  "Live comment moderation",
  "Replays of every live",
] as const;

export interface CreatorCategory {
  readonly title: string;
  readonly description: string;
  readonly icon: LandingIconName;
  readonly image: string;
  readonly imageAlt: string;
  readonly width: number;
  readonly height: number;
}

export const creatorCategories: readonly CreatorCategory[] = [
  { title: "Talk and podcasts", description: "Host a show, bring guests up and take questions from the chat.", icon: "mic", image: "/photos/talkHostStudio.webp", imageAlt: "A host in headphones smiling next to a studio microphone", width: 1000, height: 1250 },
  { title: "Music", description: "Perform live, run a gift goal for your next release and battle other artists.", icon: "music", image: "/photos/musicConcertNeon.webp", imageAlt: "A performer standing in front of a neon concert sign", width: 1000, height: 1400 },
  { title: "Gaming", description: "Stream PC or console through OBS with overlays, alerts and squad battles.", icon: "gamepad", image: "/photos/gamingSquadTrophy.webp", imageAlt: "Three friends holding controllers and laughing beside a trophy", width: 1800, height: 1013 },
  { title: "Education", description: "Teach a class, share your screen and keep recordings for students.", icon: "book", image: "/photos/classroomTeacher.webp", imageAlt: "A teacher standing in front of a class of children", width: 1600, height: 1068 },
  { title: "IRL", description: "Take viewers with you around the city, straight from your phone.", icon: "mapPin", image: "/photos/irlLagosStreet.webp", imageAlt: "A man in headphones and sunglasses on a busy street", width: 1000, height: 1500 },
  { title: "Behind the scenes", description: "Show how you shoot, edit and build. Pin products only if you sell.", icon: "film", image: "/photos/videographerRig.webp", imageAlt: "A videographer standing behind a camera on a tripod", width: 1000, height: 1500 },
];

export const landingQuestions = [
  {
    question: "Who can use Nantty Studio?",
    answer: "Studio is for members of the Nantty Creator Program. Apply in the Nantty app under Profile, Creator Program. Once you are approved, sign in here with the same Nantty account. There is no separate Studio sign-up.",
  },
  {
    question: "Do I need OBS or special gear?",
    answer: "No. You can go live straight from your phone. When you want more control, connect OBS or any encoder with the server URL and stream key in your control room, or use WHIP for lower delay.",
  },
  {
    question: "How many people can join my live?",
    answer: "Up to 10 creators can share one stage. Invite guests from your audience or other creators, and remove anyone with one tap.",
  },
  {
    question: "How do battles work?",
    answer: "Start a timed battle with one or more creators. Gifts from viewers fill each side of the score bar. Turn on winner takes all if you want the winning side to collect the gifts sent during the battle.",
  },
  {
    question: "How do I get paid?",
    answer: "Gifts and fan subscriptions are added to your earnings as they happen. Verify your ID once, add your bank account, then withdraw. Each withdrawal has a small flat fee, shown before you confirm.",
  },
  {
    question: "How much of a fan subscription do I keep?",
    answer: "You keep 80% of each subscription after app store fees. Eligible content, including ads in your comment sections, can also earn a share of ad revenue. Nantty shares eligible revenue; it does not pay per view.",
  },
  {
    question: "What are Nantty Points?",
    answer: "Nantty Points rank fans on your live and category leaderboards. They come from gifts and engagement such as watching, sharing and following. Points are for rankings only and are never cash.",
  },
  {
    question: "Do I have to sell anything?",
    answer: "No. Most lives never pin a product. If you have a Nantty store, you can pin products to a live; if you do not, Studio works exactly the same.",
  },
  {
    question: "How do I get the Blue checkmark?",
    answer: "Creators can apply for the Blue checkmark from the Nantty app once their account is verified. It shows viewers your profile is really you.",
  },
] as const;

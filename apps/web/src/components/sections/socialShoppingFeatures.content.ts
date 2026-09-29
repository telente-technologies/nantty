import type { FigmaIconName } from "../ui/figmaIcon";
import type { AppScreenName } from "../ui/phoneFrame";

export interface SocialShoppingFeature {
  readonly id: string;
  readonly tabLabel: string;
  readonly icon: FigmaIconName;
  readonly headline: string;
  readonly description: string;
  readonly screen: AppScreenName;
  readonly screenAlt: string;
}

export const socialShoppingFeatures: readonly SocialShoppingFeature[] = [
  {
    id: "feed",
    tabLabel: "Feed",
    icon: "squaresFour24",
    headline: "A feed where every post can be a shop window",
    description: "Follow sellers and creators, see what your friends liked, and tap the bag icon on a post to open the products in it.",
    screen: "homeFeedScreen",
    screenAlt: "Zudomart feed with posts from sellers, likes and shares",
  },
  {
    id: "clips",
    tabLabel: "Clips",
    icon: "play24",
    headline: "Short clips that show the real thing",
    description: "See the fabric move, the sneaker from every side and the phone switched on. Follow the seller or comment without leaving the clip.",
    screen: "shoppableClipsScreen",
    screenAlt: "Zudomart clips screen with a full-screen video, likes and comments",
  },
  {
    id: "live",
    tabLabel: "Live",
    icon: "videoCamera24",
    headline: "Live shopping, like the market but from your couch",
    description: "Join a seller's live stream, ask questions in the comments, and open the product they are showing while they talk.",
    screen: "liveShoppingScreen",
    screenAlt: "Zudomart live stream with viewer comments and a product button",
  },
  {
    id: "stories",
    tabLabel: "Stories",
    icon: "cameraBolt24",
    headline: "Stories for new drops and restocks",
    description: "Sellers post what just arrived and what is almost gone. Reply to a story to start a chat about it.",
    screen: "storyScreen",
    screenAlt: "Zudomart story screen with a reply box",
  },
];

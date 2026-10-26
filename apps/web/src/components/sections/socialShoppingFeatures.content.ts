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
    screenAlt: "Nantty feed with Adaeze Okafor's Owambe Edit post and a shop bag on the photo",
  },
  {
    id: "clips",
    tabLabel: "Clips",
    icon: "play24",
    headline: "Short clips that show the real thing",
    description: "See the fabric move, the sneaker from every side and the phone switched on. Follow the seller or comment without leaving the clip.",
    screen: "shoppableClipsScreen",
    screenAlt: "Nantty clip of Adaeze Styles packing orders, with likes, comments and share",
  },
  {
    id: "live",
    tabLabel: "Live",
    icon: "videoCamera24",
    headline: "Live streams for shows, music, games and shopping",
    description: "Watch creators talk, play, perform and teach, send gifts, and join the chat. When a seller is live, open the product they are showing without leaving the stream.",
    screen: "liveShoppingScreen",
    screenAlt: "A live session promoted in Clips with a Watch live button and viewer count",
  },
  {
    id: "stories",
    tabLabel: "Stories",
    icon: "cameraBolt24",
    headline: "Stories for new drops and restocks",
    description: "Sellers post what just arrived and what is almost gone. Reply to a story to start a chat about it.",
    screen: "storyScreen",
    screenAlt: "Tunde Bakare's story showing headphones back in stock, with a reply box",
  },
];

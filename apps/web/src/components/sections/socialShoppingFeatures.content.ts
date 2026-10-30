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
    headline: "A social feed designed to make discovery easier",
    description: "We’re building a feed for seller and creator posts, with product links where they are available.",
    screen: "homeFeedScreen",
    screenAlt: "Nantty feed with Adaeze Okafor's Owambe Edit post and a shop bag on the photo",
  },
  {
    id: "clips",
    tabLabel: "Clips",
    icon: "play24",
    headline: "Clips for seeing products in context",
    description: "The planned clips experience lets sellers and creators show products in motion, with ways to follow or ask questions as features become available.",
    screen: "shoppableClipsScreen",
    screenAlt: "Nantty clip of Adaeze Styles packing orders, with likes, comments and share",
  },
  {
    id: "live",
    tabLabel: "Live",
    icon: "videoCamera24",
    headline: "Live video is a separate beta capability",
    description: "Video LIVE is being improved and is not part of the initial launch. Hosting requires Creator Program approval; availability and features may change during beta.",
    screen: "liveShoppingScreen",
    screenAlt: "A live session promoted in Clips with a Watch live button and viewer count",
  },
  {
    id: "stories",
    tabLabel: "Stories",
    icon: "cameraBolt24",
    headline: "Stories for seller and creator updates",
    description: "Stories are part of the planned discovery experience for updates from sellers and creators. Final availability and interactions will be confirmed before launch.",
    screen: "storyScreen",
    screenAlt: "Tunde Bakare's story showing headphones back in stock, with a reply box",
  },
];

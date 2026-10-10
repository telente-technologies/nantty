import type { IconProps } from "./icon.types";
import { ArrowsClockwiseIcon, BookmarkIcon, ChartBarIcon, ChatCircleIcon, GiftIcon, HeartIcon, PaperPlaneTiltIcon, ShareNetworkIcon } from "./phosphorGlyphs";
import { phosphorIcon } from "./phosphorIcon";

type ToggleIconProps = IconProps & { readonly filled?: boolean };

export const ReplyActionIcon = phosphorIcon(ChatCircleIcon);
export const RepostActionIcon = phosphorIcon(ArrowsClockwiseIcon);
export const ViewsActionIcon = phosphorIcon(ChartBarIcon);
export const ShareActionIcon = phosphorIcon(ShareNetworkIcon);
export const SendActionIcon = phosphorIcon(PaperPlaneTiltIcon);
export const GiftActionIcon = phosphorIcon(GiftIcon);

const LikeOutline = phosphorIcon(HeartIcon);
const LikeFilled = phosphorIcon(HeartIcon, { weight: "fill" });
const BookmarkOutline = phosphorIcon(BookmarkIcon);
const BookmarkFilled = phosphorIcon(BookmarkIcon, { weight: "fill" });

export function LikeActionIcon({ filled = false, ...props }: ToggleIconProps) {
  return filled ? <LikeFilled {...props} /> : <LikeOutline {...props} />;
}

export function BookmarkActionIcon({ filled = false, ...props }: ToggleIconProps) {
  return filled ? <BookmarkFilled {...props} /> : <BookmarkOutline {...props} />;
}

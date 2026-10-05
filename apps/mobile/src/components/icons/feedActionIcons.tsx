import type { IconProps } from "./icon.types";
import { BookmarkSimpleIcon, ChartBarIcon, ChatCircleIcon, ExportIcon, GiftIcon, HeartIcon, PaperPlaneTiltIcon, RepeatIcon } from "./phosphorGlyphs";
import { phosphorIcon } from "./phosphorIcon";

type ToggleIconProps = IconProps & { readonly filled?: boolean };

export const ReplyActionIcon = phosphorIcon(ChatCircleIcon);
export const RepostActionIcon = phosphorIcon(RepeatIcon);
export const ViewsActionIcon = phosphorIcon(ChartBarIcon);
export const ShareActionIcon = phosphorIcon(ExportIcon);
export const SendActionIcon = phosphorIcon(PaperPlaneTiltIcon);
export const GiftActionIcon = phosphorIcon(GiftIcon);

const LikeOutline = phosphorIcon(HeartIcon);
const LikeFilled = phosphorIcon(HeartIcon, { weight: "fill" });
const BookmarkOutline = phosphorIcon(BookmarkSimpleIcon);
const BookmarkFilled = phosphorIcon(BookmarkSimpleIcon, { weight: "fill" });

export function LikeActionIcon({ filled = false, ...props }: ToggleIconProps) {
  return filled ? <LikeFilled {...props} /> : <LikeOutline {...props} />;
}

export function BookmarkActionIcon({ filled = false, ...props }: ToggleIconProps) {
  return filled ? <BookmarkFilled {...props} /> : <BookmarkOutline {...props} />;
}

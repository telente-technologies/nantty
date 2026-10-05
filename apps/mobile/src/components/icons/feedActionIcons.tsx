import { BookmarkSimpleIcon } from "phosphor-react-native/src/icons/BookmarkSimple";
import { ChartBarIcon } from "phosphor-react-native/src/icons/ChartBar";
import { ChatCircleIcon } from "phosphor-react-native/src/icons/ChatCircle";
import { ExportIcon } from "phosphor-react-native/src/icons/Export";
import { GiftIcon } from "phosphor-react-native/src/icons/Gift";
import { HeartIcon } from "phosphor-react-native/src/icons/Heart";
import { PaperPlaneTiltIcon } from "phosphor-react-native/src/icons/PaperPlaneTilt";
import { RepeatIcon } from "phosphor-react-native/src/icons/Repeat";

import type { IconProps } from "./icon.types";
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

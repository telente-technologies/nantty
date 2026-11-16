import {
  ArrowsLeftRightIcon as PhArrowsLeftRight,
  BookOpenIcon as PhBookOpen,
  CaretRightIcon as PhCaretRight,
  ChatCircleTextIcon as PhChatCircleText,
  ChartLineUpIcon as PhChartLineUp,
  ClockIcon as PhClock,
  CodeIcon as PhCode,
  ListMagnifyingGlassIcon as PhListMagnifyingGlass,
  PlugsConnectedIcon as PhPlugsConnected,
  PlayCircleIcon as PhPlayCircle,
  PlayIcon as PhPlay,
  QuestionIcon as PhQuestion,
  ShareNetworkIcon as PhShare,
  SquaresFourIcon as PhSquaresFour,
  TestTubeIcon as PhTestTube,
  WarningCircleIcon as PhWarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon, IconProps as PhosphorIconProps } from "@phosphor-icons/react";

export type IconProps = Omit<PhosphorIconProps, "children" | "ref">;

function createIcon(IconComponent: Icon) {
  return function AppIcon({ size = 20, ...props }: IconProps) {
    return <IconComponent size={size} aria-hidden="true" focusable="false" {...props} />;
  };
}

export const ActivityIcon = createIcon(PhChartLineUp);
export const ArrowsLeftRightIcon = createIcon(PhArrowsLeftRight);
export const BookOpenIcon = createIcon(PhBookOpen);
export const CaretRightIcon = createIcon(PhCaretRight);
export const ChatCircleTextIcon = createIcon(PhChatCircleText);
export const ClockIcon = createIcon(PhClock);
export const CodeIcon = createIcon(PhCode);
export const HelpIcon = createIcon(PhQuestion);
export const ListMagnifyingGlassIcon = createIcon(PhListMagnifyingGlass);
export const PlugsConnectedIcon = createIcon(PhPlugsConnected);
export const PlayCircleIcon = createIcon(PhPlayCircle);
export const PlayIcon = createIcon(PhPlay);
export const ShareIcon = createIcon(PhShare);
export const SquaresFourIcon = createIcon(PhSquaresFour);
export const TestTubeIcon = createIcon(PhTestTube);
export const WarningCircleIcon = createIcon(PhWarningCircle);

import {
  ArrowsLeftRightIcon as PhArrowsLeftRight,
  BookOpenIcon as PhBookOpen,
  BuildingsIcon as PhBuildings,
  BriefcaseIcon as PhBriefcase,
  CaretRightIcon as PhCaretRight,
  ChartLineUpIcon as PhChartLineUp,
  ChatCircleTextIcon as PhChatCircleText,
  CircleNotchIcon as PhCircleNotch,
  CodeIcon as PhCode,
  KeyIcon as PhKey,
  ListMagnifyingGlassIcon as PhListMagnifyingGlass,
  PlugsConnectedIcon as PhPlugsConnected,
  LockIcon as PhLock,
  PlayCircleIcon as PhPlayCircle,
  QuestionIcon as PhQuestion,
  ShareNetworkIcon as PhShare,
  SquaresFourIcon as PhSquaresFour,
  TestTubeIcon as PhTestTube,
  WalletIcon as PhWallet,
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
export const BuildingsIcon = createIcon(PhBuildings);
export const BriefcaseIcon = createIcon(PhBriefcase);
export const CaretRightIcon = createIcon(PhCaretRight);
export const ChatCircleTextIcon = createIcon(PhChatCircleText);
export const CircleNotchIcon = createIcon(PhCircleNotch);
export const CodeIcon = createIcon(PhCode);
export const HelpIcon = createIcon(PhQuestion);
export const KeyIcon = createIcon(PhKey);
export const ListMagnifyingGlassIcon = createIcon(PhListMagnifyingGlass);
export const LockIcon = createIcon(PhLock);
export const PlayCircleIcon = createIcon(PhPlayCircle);
export const PlugsConnectedIcon = createIcon(PhPlugsConnected);
export const ShareIcon = createIcon(PhShare);
export const SquaresFourIcon = createIcon(PhSquaresFour);
export const TestTubeIcon = createIcon(PhTestTube);
export const WalletIcon = createIcon(PhWallet);
export const WarningCircleIcon = createIcon(PhWarningCircle);

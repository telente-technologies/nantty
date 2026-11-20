import {
  ArrowRightIcon as PhArrowRight,
  ArrowsLeftRightIcon as PhArrowsLeftRight,
  BookOpenIcon as PhBookOpen,
  CaretRightIcon as PhCaretRight,
  ChatCircleTextIcon as PhChatCircleText,
  ChartLineUpIcon as PhChartLineUp,
  CheckCircleIcon as PhCheckCircle,
  ClockIcon as PhClock,
  CodeIcon as PhCode,
  LightningIcon as PhLightning,
  ListMagnifyingGlassIcon as PhListMagnifyingGlass,
  PlugsConnectedIcon as PhPlugsConnected,
  PlayCircleIcon as PhPlayCircle,
  PlayIcon as PhPlay,
  QuestionIcon as PhQuestion,
  ShareNetworkIcon as PhShare,
  ShieldCheckIcon as PhShieldCheck,
  SignInIcon as PhSignIn,
  SquaresFourIcon as PhSquaresFour,
  TerminalWindowIcon as PhTerminalWindow,
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
export const ArrowRightIcon = createIcon(PhArrowRight);
export const ArrowsLeftRightIcon = createIcon(PhArrowsLeftRight);
export const BookOpenIcon = createIcon(PhBookOpen);
export const CaretRightIcon = createIcon(PhCaretRight);
export const ChatCircleTextIcon = createIcon(PhChatCircleText);
export const CheckCircleIcon = createIcon(PhCheckCircle);
export const ClockIcon = createIcon(PhClock);
export const CodeIcon = createIcon(PhCode);
export const HelpIcon = createIcon(PhQuestion);
export const LightningIcon = createIcon(PhLightning);
export const ListMagnifyingGlassIcon = createIcon(PhListMagnifyingGlass);
export const PlugsConnectedIcon = createIcon(PhPlugsConnected);
export const PlayCircleIcon = createIcon(PhPlayCircle);
export const PlayIcon = createIcon(PhPlay);
export const ShareIcon = createIcon(PhShare);
export const ShieldCheckIcon = createIcon(PhShieldCheck);
export const SignInIcon = createIcon(PhSignIn);
export const SquaresFourIcon = createIcon(PhSquaresFour);
export const TerminalWindowIcon = createIcon(PhTerminalWindow);
export const TestTubeIcon = createIcon(PhTestTube);
export const WarningCircleIcon = createIcon(PhWarningCircle);

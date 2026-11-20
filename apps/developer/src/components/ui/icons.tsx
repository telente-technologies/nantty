import {
  ArrowLeftIcon as PhArrowLeft,
  ArrowRightIcon as PhArrowRight,
  ArrowsLeftRightIcon as PhArrowsLeftRight,
  BookOpenIcon as PhBookOpen,
  BuildingsIcon as PhBuildings,
  BriefcaseIcon as PhBriefcase,
  CaretRightIcon as PhCaretRight,
  ChartLineUpIcon as PhChartLineUp,
  ChatCircleTextIcon as PhChatCircleText,
  CheckCircleIcon as PhCheckCircle,
  CheckIcon as PhCheck,
  CircleNotchIcon as PhCircleNotch,
  ClockIcon as PhClock,
  CodeIcon as PhCode,
  CompassIcon as PhCompass,
  CopyIcon as PhCopy,
  EnvelopeSimpleIcon as PhEnvelopeSimple,
  KeyIcon as PhKey,
  LightningIcon as PhLightning,
  ListIcon as PhList,
  ListMagnifyingGlassIcon as PhListMagnifyingGlass,
  LockIcon as PhLock,
  LockKeyIcon as PhLockKey,
  MagnifyingGlassIcon as PhMagnifyingGlass,
  PlayCircleIcon as PhPlayCircle,
  PlugsConnectedIcon as PhPlugsConnected,
  QuestionIcon as PhQuestion,
  ShareNetworkIcon as PhShare,
  ShieldCheckIcon as PhShieldCheck,
  SignInIcon as PhSignIn,
  SquaresFourIcon as PhSquaresFour,
  TerminalWindowIcon as PhTerminalWindow,
  TestTubeIcon as PhTestTube,
  UserPlusIcon as PhUserPlus,
  WalletIcon as PhWallet,
  WarningCircleIcon as PhWarningCircle,
  XIcon as PhX,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon, IconProps as PhosphorIconProps } from "@phosphor-icons/react";

export type IconProps = Omit<PhosphorIconProps, "children" | "ref">;

function createIcon(IconComponent: Icon) {
  return function AppIcon({ size = 20, ...props }: IconProps) {
    return <IconComponent size={size} aria-hidden="true" focusable="false" {...props} />;
  };
}

export const ActivityIcon = createIcon(PhChartLineUp);
export const ArrowLeftIcon = createIcon(PhArrowLeft);
export const ArrowRightIcon = createIcon(PhArrowRight);
export const ArrowsLeftRightIcon = createIcon(PhArrowsLeftRight);
export const BookOpenIcon = createIcon(PhBookOpen);
export const BuildingsIcon = createIcon(PhBuildings);
export const BriefcaseIcon = createIcon(PhBriefcase);
export const CaretRightIcon = createIcon(PhCaretRight);
export const ChatCircleTextIcon = createIcon(PhChatCircleText);
export const CheckCircleIcon = createIcon(PhCheckCircle);
export const CheckIcon = createIcon(PhCheck);
export const CircleNotchIcon = createIcon(PhCircleNotch);
export const ClockIcon = createIcon(PhClock);
export const CodeIcon = createIcon(PhCode);
export const CompassIcon = createIcon(PhCompass);
export const CopyIcon = createIcon(PhCopy);
export const EnvelopeSimpleIcon = createIcon(PhEnvelopeSimple);
export const HelpIcon = createIcon(PhQuestion);
export const KeyIcon = createIcon(PhKey);
export const LightningIcon = createIcon(PhLightning);
export const ListIcon = createIcon(PhList);
export const ListMagnifyingGlassIcon = createIcon(PhListMagnifyingGlass);
export const LockIcon = createIcon(PhLock);
export const LockKeyIcon = createIcon(PhLockKey);
export const MagnifyingGlassIcon = createIcon(PhMagnifyingGlass);
export const PlayCircleIcon = createIcon(PhPlayCircle);
export const PlugsConnectedIcon = createIcon(PhPlugsConnected);
export const ShareIcon = createIcon(PhShare);
export const ShieldCheckIcon = createIcon(PhShieldCheck);
export const SignInIcon = createIcon(PhSignIn);
export const SquaresFourIcon = createIcon(PhSquaresFour);
export const TerminalWindowIcon = createIcon(PhTerminalWindow);
export const TestTubeIcon = createIcon(PhTestTube);
export const UserPlusIcon = createIcon(PhUserPlus);
export const WalletIcon = createIcon(PhWallet);
export const WarningCircleIcon = createIcon(PhWarningCircle);
export const XIcon = createIcon(PhX);

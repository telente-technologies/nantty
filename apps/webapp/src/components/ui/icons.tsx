import {
  ArrowRightIcon as PhArrowRight, ArrowSquareOutIcon, BookmarkSimpleIcon, CaretLeftIcon, ChartBarIcon, ChatCircleIcon, CheckCircleIcon as PhCheckCircle, CompassIcon as PhCompass, CopyIcon as PhCopy, CopyrightIcon as PhCopyright, DownloadSimpleIcon, EnvelopeIcon,
  ExportIcon, FileTextIcon, FlagIcon as PhFlag, GearIcon, GiftIcon as PhGift, HeartIcon as PhHeart, LinkSimpleIcon as PhLinkSimple, MonitorIcon as PhMonitor, MoonIcon as PhMoon, PackageIcon as PhPackage,
  PaperPlaneTiltIcon, PauseIcon as PhPause, PhoneIcon as PhPhone, ProhibitIcon as PhProhibit, PushPinIcon as PhPushPin, QuotesIcon, RepeatIcon, ShieldCheckIcon, SignInIcon as PhSignIn, SignOutIcon, SpeakerHighIcon as PhSpeakerHigh, SpeakerXIcon as PhSpeakerX, SunIcon as PhSun, TrendUpIcon,
  UsersIcon, WalletIcon as PhWallet, WarningIcon, BellIcon as PhBell, BellRingingIcon, BellSlashIcon, UserMinusIcon,
  ArrowClockwiseIcon, ArrowCounterClockwiseIcon, CornersInIcon, CornersOutIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon, IconProps as PhosphorIconProps, IconWeight } from "@phosphor-icons/react";

import { AppIcon, type AppIconName } from "./appIcon";

export type IconProps = Omit<PhosphorIconProps, "children" | "ref">;

function createIcon(PhosphorIcon: Icon, defaultWeight: IconWeight = "regular") {
  return function PhosphorGlyph({ size = 22, weight = defaultWeight, ...rest }: IconProps) {
    return <PhosphorIcon size={size} weight={weight} aria-hidden="true" focusable="false" {...rest} />;
  };
}

function createFigmaIcon(name: AppIconName) {
  return function FigmaIcon({ size = 22, className }: IconProps) {
    return <AppIcon name={name} size={typeof size === "number" ? size : 22} className={className} />;
  };
}

export const CompassIcon = createIcon(PhCompass);
export const ChevronLeftIcon = createIcon(CaretLeftIcon);
export const PackageIcon = createIcon(PhPackage);
export const SettingsIcon = createIcon(GearIcon);
export const LogOutIcon = createIcon(SignOutIcon);
export const MailIcon = createIcon(EnvelopeIcon);
export const PhoneIcon = createIcon(PhPhone);

export const HomeIcon = createFigmaIcon("home33");
export const CartIcon = createFigmaIcon("shoppingCart24");
export const ChatIcon = createFigmaIcon("chatCircle24");
export const UserIcon = createFigmaIcon("userCircle24");
export const BellIcon = createFigmaIcon("bell24");
export const SearchIcon = createFigmaIcon("magnifyingGlass24");
export const HeartIcon = createFigmaIcon("heart24");
export const StarIcon = createFigmaIcon("star16");
export const ChevronRightIcon = createFigmaIcon("caretRight24");
export const ChevronDownIcon = createFigmaIcon("caretDown24");
export const ArrowLeftIcon = createFigmaIcon("arrowLeft24");
export const PlusIcon = createFigmaIcon("plus24");
export const CloseIcon = createFigmaIcon("cancel20");
export const ShareIcon = createFigmaIcon("share24");
export const MoreIcon = createFigmaIcon("dotsThreeVertical24");
export const CheckIcon = createFigmaIcon("check16");
export const TrashIcon = createFigmaIcon("trash24");
export const StoreIcon = createFigmaIcon("buildingStore20");
export const FilterIcon = createFigmaIcon("slidersHorizontal24");
export const CreditCardIcon = createFigmaIcon("creditCard24");
export const MapPinIcon = createFigmaIcon("mapPin24");
export const ImageIcon = createFigmaIcon("imageSquare24");
export const AnalyticsIcon = createFigmaIcon("speedometer24");
export const EyeIcon = createFigmaIcon("eye24");
export const LockIcon = createFigmaIcon("lockSimple24");
export const TagIcon = createFigmaIcon("tag24");
export const BookmarkIcon = createFigmaIcon("bookmarkSimple24");
export const CoinIcon = createFigmaIcon("coin24");
export const ClipsIcon = createFigmaIcon("flips34");
export const GiftIcon = createFigmaIcon("gift24");
export const LiveIcon = createFigmaIcon("videoCamera24");
export const PlayIcon = createFigmaIcon("play24");
export const OrdersIcon = createFigmaIcon("truck24");
export const CreatorIcon = createFigmaIcon("cameraBolt24");
export const SidebarToggleIcon = createFigmaIcon("textIndent24");
export const GridIcon = createFigmaIcon("squaresFour24");
export const SendIcon = createFigmaIcon("paperPlaneTilt24");

export const PauseIcon = createIcon(PhPause, "fill");
export const SunIcon = createIcon(PhSun);
export const MoonIcon = createIcon(PhMoon);
export const MonitorIcon = createIcon(PhMonitor);
export const TrendingIcon = createIcon(TrendUpIcon);
export const ShieldIcon = createIcon(ShieldCheckIcon);
export const DocumentIcon = createIcon(FileTextIcon);
export const AlertIcon = createIcon(WarningIcon);
export const ExternalLinkIcon = createIcon(ArrowSquareOutIcon);
export const DownloadIcon = createIcon(DownloadSimpleIcon);
export const WalletIcon = createIcon(PhWallet);
export const ArrowRightIcon = createIcon(PhArrowRight);

export const ReplyActionIcon = createIcon(ChatCircleIcon);
export const RepostActionIcon = createIcon(RepeatIcon);
export const QuoteActionIcon = createIcon(QuotesIcon);
export const LikeActionIcon = createIcon(PhHeart);
export const LikeFilledActionIcon = createIcon(PhHeart, "fill");
export const ViewsActionIcon = createIcon(ChartBarIcon);
export const BookmarkActionIcon = createIcon(BookmarkSimpleIcon);
export const BookmarkFilledActionIcon = createIcon(BookmarkSimpleIcon, "fill");
export const ShareActionIcon = createIcon(ExportIcon);
export const SendActionIcon = createIcon(PaperPlaneTiltIcon);
export const GiftActionIcon = createIcon(PhGift);
export const PersonTagIcon = createIcon(UsersIcon);
export const PinIcon = createIcon(PhPushPin);
export const FlagIcon = createIcon(PhFlag);
export const LinkIcon = createIcon(PhLinkSimple);
export const CopyIcon = createIcon(PhCopy);
export const CopyrightIcon = createIcon(PhCopyright);
export const SignInIcon = createIcon(PhSignIn);
export const ProhibitIcon = createIcon(PhProhibit);
export const SuccessIcon = createIcon(PhCheckCircle);
export const SpeakerHighIcon = createIcon(PhSpeakerHigh);
export const SpeakerMutedIcon = createIcon(PhSpeakerX);
export const PostBellIcon = createIcon(PhBell);
export const PostBellRingingIcon = createIcon(BellRingingIcon, "fill");
export const PostBellSlashIcon = createIcon(BellSlashIcon);
export const UnfollowIcon = createIcon(UserMinusIcon);
export const SkipBackIcon = createIcon(ArrowCounterClockwiseIcon, "bold");
export const SkipAheadIcon = createIcon(ArrowClockwiseIcon, "bold");
export const EnterFullscreenIcon = createIcon(CornersOutIcon, "bold");
export const ExitFullscreenIcon = createIcon(CornersInIcon, "bold");

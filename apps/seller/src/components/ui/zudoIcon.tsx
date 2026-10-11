import type { ReactNode } from "react";
import {
  ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, ArrowUpRightIcon, ArrowsClockwiseIcon, ArrowsOutSimpleIcon, BellIcon, BellRingingIcon,
  BookmarkSimpleIcon, BoxArrowDownIcon, CalendarDotsIcon, CameraIcon, CaretDownIcon, CaretRightIcon, CaretUpDownIcon, CaretUpIcon, ChatCircleIcon,
  CheckIcon, CodeIcon, CopyIcon, CreditCardIcon, DotsSixVerticalIcon, DotsThreeVerticalIcon, ExportIcon, EyeClosedIcon, EyeIcon, HeadsetIcon, HeartIcon, ImageIcon, ImageSquareIcon,
  MagnifyingGlassIcon, MapPinIcon, MinusIcon, PaperPlaneTiltIcon, PlusIcon, QuestionIcon, RepeatIcon, SealCheckIcon, ShareNetworkIcon, ShieldIcon,
  ShoppingCartIcon, SignOutIcon, SlidersHorizontalIcon, SpeakerHighIcon, SpeedometerIcon, SquaresFourIcon, StarIcon, StorefrontIcon, TagIcon,
  TextIndentIcon, TrashIcon, TruckIcon, UserCircleIcon, VideoCameraIcon, WarningIcon, XIcon,
  ChecksIcon, FileTextIcon, LockKeyIcon, PackageIcon, PaperclipIcon, ReceiptIcon, ShareFatIcon, ShieldCheckIcon, WifiSlashIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon, IconWeight } from "@phosphor-icons/react";

import styles from "./zudoIcon.module.css";

const iconMap = {
  arrowDown24: [ArrowDownIcon], arrowRight24: [ArrowRightIcon], arrowUp24: [ArrowUpIcon], caretUp24: [CaretUpIcon], caretUpDown24: [CaretUpDownIcon],
  arrowLeft24: [ArrowLeftIcon], arrowsOutSimple24: [ArrowsOutSimpleIcon], arrowUpRight24: [ArrowUpRightIcon], bell24: [BellIcon],
  bellRinging24: [BellRingingIcon], bookmarkSimple24: [BookmarkSimpleIcon], boxArrowDown24: [BoxArrowDownIcon], buildingStore20: [StorefrontIcon],
  calendarDots16: [CalendarDotsIcon], camera24: [CameraIcon], cancel20: [XIcon], caretDown24: [CaretDownIcon], caretRight24: [CaretRightIcon],
  chatCircle24: [ChatCircleIcon], check16: [CheckIcon], code20: [CodeIcon], copy16: [CopyIcon], creditCard24: [CreditCardIcon], dotsSixVertical16: [DotsSixVerticalIcon], dotsThreeVertical24: [DotsThreeVerticalIcon],
  export24: [ExportIcon], eye20: [EyeIcon], eyeClosed20: [EyeClosedIcon], headset24: [HeadsetIcon], heart24: [HeartIcon], image24: [ImageIcon],
  imageSquare24: [ImageSquareIcon], magnifyingGlass20: [MagnifyingGlassIcon], mapPin24: [MapPinIcon], minus16: [MinusIcon],
  paperPlaneTilt24: [PaperPlaneTiltIcon], plus16: [PlusIcon], question24: [QuestionIcon], refresh20: [ArrowsClockwiseIcon], repeat24: [RepeatIcon],
  sealCheck20: [SealCheckIcon, "fill"], share24: [ShareNetworkIcon], shield24: [ShieldIcon], shoppingCart24: [ShoppingCartIcon], signOut24: [SignOutIcon],
  slidersHorizontal24: [SlidersHorizontalIcon], speakerHigh24: [SpeakerHighIcon], speedometer24: [SpeedometerIcon], squaresFour24: [SquaresFourIcon],
  star16: [StarIcon, "fill"], tag24: [TagIcon], textIndent24: [TextIndentIcon], trash24: [TrashIcon], truck24: [TruckIcon],
  userCircle24: [UserCircleIcon], userProfile45: [UserCircleIcon], videoCamera24: [VideoCameraIcon], warning20: [WarningIcon],
  checks16: [ChecksIcon], fileText24: [FileTextIcon], lockKey24: [LockKeyIcon], package24: [PackageIcon], paperclip24: [PaperclipIcon],
  receipt24: [ReceiptIcon], shareFat24: [ShareFatIcon], shieldCheck24: [ShieldCheckIcon], wifiSlash20: [WifiSlashIcon],
} as const satisfies Record<string, readonly [Icon] | readonly [Icon, IconWeight]>;

export type ZudoIconName = keyof typeof iconMap;

interface ZudoIconProps {
  readonly name: ZudoIconName;
  readonly size?: number;
  readonly className?: string;
  readonly label?: string;
}

export function ZudoIcon({ name, size = 20, className, label }: ZudoIconProps) {
  const [PhosphorIcon, weight = "regular"] = iconMap[name] as readonly [Icon, IconWeight?];
  return (
    <PhosphorIcon
      size={size}
      weight={weight}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
      className={className ? `${styles.icon} ${className}` : styles.icon}
    />
  );
}

export function IconLabel({ name, size = 14, children, className }: { readonly name: ZudoIconName; readonly size?: number; readonly children: ReactNode; readonly className?: string }) {
  return (
    <span className={className ? `${styles.iconLabel} ${className}` : styles.iconLabel}>
      <ZudoIcon name={name} size={size} />
      {children}
    </span>
  );
}

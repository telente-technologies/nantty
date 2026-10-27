import type { ReactNode } from "react";
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BookmarkSimple,
  CalendarDots,
  CaretDown,
  CaretRight,
  ChatCircle,
  Check,
  Copy,
  CreditCard,
  DotsThreeVertical,
  Export,
  Eye,
  EyeClosed,
  Gauge,
  Headset,
  Image,
  MagnifyingGlass,
  Minus,
  Play,
  Plus,
  SealCheck,
  Shield,
  ShoppingBagOpen,
  ShoppingCart,
  SlidersHorizontal,
  SpeakerHigh,
  SquaresFour,
  Star,
  Storefront,
  Tag,
  TextIndent,
  Trash,
  Truck,
  UserCircle,
  VideoCamera,
  Warning,
  X,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react/dist/lib/types";

import type { NanttyIconName } from "@/constants/nanttyIconNames.constant";

import styles from "./nanttyIcon.module.css";

const phosphorIconByName: Record<NanttyIconName, Icon> = {
  arrowLeft24: ArrowLeft,
  arrowUpRight24: ArrowUpRight,
  bell24: Bell,
  bookmarkSimple24: BookmarkSimple,
  buildingStore20: Storefront,
  calendarDots16: CalendarDots,
  cancel20: X,
  caretDown24: CaretDown,
  caretRight24: CaretRight,
  chatCircle24: ChatCircle,
  check16: Check,
  copy16: Copy,
  creditCard24: CreditCard,
  dotsThreeVertical24: DotsThreeVertical,
  export24: Export,
  eye16: Eye,
  eyeClosed20: EyeClosed,
  headset24: Headset,
  image24: Image,
  magnifyingGlass16: MagnifyingGlass,
  minus16: Minus,
  play24: Play,
  plus16: Plus,
  refresh20: ArrowClockwise,
  sealCheck20: SealCheck,
  shield24: Shield,
  shoppingCart24: ShoppingCart,
  slidersHorizontal24: SlidersHorizontal,
  speakerHigh24: SpeakerHigh,
  speedometer24: Gauge,
  squaresFour24: SquaresFour,
  star16: Star,
  tag24: Tag,
  textIndent24: TextIndent,
  trash24: Trash,
  truck24: Truck,
  userCircle24: UserCircle,
  userProfile45: UserCircle,
  videoCamera24: VideoCamera,
  viewProducts24: ShoppingBagOpen,
  warning20: Warning,
};

interface NanttyIconProps {
  readonly name: NanttyIconName;
  readonly size?: number;
  readonly className?: string;
  readonly label?: string;
}

export function NanttyIcon({ name, size = 16, className, label }: NanttyIconProps) {
  const PhosphorIcon = phosphorIconByName[name];
  return (
    <span aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label} className={className ? `${styles.icon} ${className}` : styles.icon}>
      <PhosphorIcon size={size} weight="regular" aria-hidden focusable="false" />
    </span>
  );
}

export function IconLabel({ name, size = 14, children, className }: { readonly name: NanttyIconName; readonly size?: number; readonly children: ReactNode; readonly className?: string }) {
  return (
    <span className={className ? `${styles.iconLabel} ${className}` : styles.iconLabel}>
      <NanttyIcon name={name} size={size} />
      {children}
    </span>
  );
}

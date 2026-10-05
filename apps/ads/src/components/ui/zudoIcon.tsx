import {
  ArrowClockwise,
  ArrowLeft,
  ArrowsOutSimple,
  ArrowUpRight,
  Bell,
  BellRinging,
  BookmarkSimple,
  BoxArrowDown,
  CalendarDots,
  Camera,
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
  FilmSlate,
  Gauge,
  Headset,
  Heart,
  House,
  Image,
  ImageSquare,
  MagnifyingGlass,
  MapPin,
  Minus,
  PaperPlaneTilt,
  Play,
  Plus,
  Question,
  Repeat,
  SealCheck,
  ShareNetwork,
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

import type { zudoIconNames } from "@/constants/zudoIconNames.constant";

import styles from "./zudoIcon.module.css";

export type ZudoIconName = (typeof zudoIconNames)[number];

const phosphorIconByName: Record<ZudoIconName, Icon> = {
  arrowLeft24: ArrowLeft,
  arrowsOutSimple24: ArrowsOutSimple,
  arrowUpRight24: ArrowUpRight,
  bell24: Bell,
  bellRinging24: BellRinging,
  bookmarkSimple24: BookmarkSimple,
  boxArrowDown24: BoxArrowDown,
  brandLine24: ChatCircle,
  buildingStore20: Storefront,
  calendarDots16: CalendarDots,
  camera24: Camera,
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
  eye20: Eye,
  eyeClosed20: EyeClosed,
  flips34: FilmSlate,
  headset24: Headset,
  heart24Alt: Heart,
  heart24: Heart,
  home33: House,
  image24: Image,
  imageSquare24: ImageSquare,
  magnifyingGlass16: MagnifyingGlass,
  magnifyingGlass20: MagnifyingGlass,
  mapPin24: MapPin,
  minus16: Minus,
  paperPlaneTilt24: PaperPlaneTilt,
  play24: Play,
  plus16: Plus,
  plus24: Plus,
  question24: Question,
  refresh20: ArrowClockwise,
  refresh24: ArrowClockwise,
  repeat24: Repeat,
  sealCheck20: SealCheck,
  share24: ShareNetwork,
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

interface ZudoIconProps {
  readonly name: ZudoIconName;
  readonly size?: number;
  readonly className?: string;
  readonly label?: string;
}

export function ZudoIcon({ name, size = 18, className, label }: ZudoIconProps) {
  const PhosphorIcon = phosphorIconByName[name];
  return (
    <span
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      className={className ? `${styles.icon} ${className}` : styles.icon}
    >
      <PhosphorIcon size={size} weight="regular" aria-hidden focusable="false" />
    </span>
  );
}

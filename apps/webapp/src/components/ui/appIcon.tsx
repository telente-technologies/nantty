import type { ReactNode } from "react";
import {
  AppleLogoIcon, ArrowDownIcon, BankIcon, AtIcon, EnvelopeSimpleIcon, EyeSlashIcon, FileLockIcon, FlagIcon, HashIcon, HeadsetIcon, IdentificationCardIcon, InfoIcon, LockKeyIcon, PhoneIcon, ScalesIcon, ShieldCheckIcon, ShieldStarIcon, SignOutIcon, TrademarkRegisteredIcon, UserMinusIcon, ArrowLeftIcon, ArrowUpIcon, BellIcon, BellSlashIcon, BookmarkSimpleIcon, CameraIcon, CaretDownIcon, CaretRightIcon, ChatCircleIcon,
  CheckIcon, CoinIcon, CreditCardIcon, CrownIcon, DotsThreeVerticalIcon, EyeIcon, FileTextIcon, FilmSlateIcon, GiftIcon, GlobeHemisphereWestIcon, HeartIcon, HouseIcon, ImageSquareIcon,
  LockSimpleIcon, MagnifyingGlassIcon, MapPinIcon, MusicNotesIcon, PackageIcon, PaperPlaneTiltIcon, PlayIcon, PlusIcon, ProhibitIcon, PushPinIcon, RocketLaunchIcon, SealCheckIcon,
  ShareNetworkIcon, ShieldIcon, ShoppingBagIcon, ShoppingCartIcon, SlidersHorizontalIcon, SparkleIcon, SpeedometerIcon, SquaresFourIcon, StarIcon,
  StorefrontIcon, TagIcon, TextIndentIcon, TrashIcon, TrophyIcon, TruckIcon, UserCircleIcon, UserPlusIcon, VideoCameraIcon, WarningIcon, XIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon, IconWeight } from "@phosphor-icons/react";

import styles from "./appIcon.module.css";

const phosphorIcons = {
  apple24: [AppleLogoIcon, "fill"], bank24: [BankIcon], arrowLeft24: [ArrowLeftIcon], bell24: [BellIcon], bellSlash24: [BellSlashIcon], bookmarkSimple24: [BookmarkSimpleIcon],
  buildingStore20: [StorefrontIcon], cameraBolt24: [CameraIcon], cancel20: [XIcon], caretDown24: [CaretDownIcon], caretRight24: [CaretRightIcon],
  chatCircle24: [ChatCircleIcon], check16: [CheckIcon], coin24: [CoinIcon], creditCard24: [CreditCardIcon], dotsThreeVertical24: [DotsThreeVerticalIcon],
  eye24: [EyeIcon], flips34: [FilmSlateIcon], gift24: [GiftIcon], heart24: [HeartIcon], home33: [HouseIcon, "fill"], imageSquare24: [ImageSquareIcon],
  lockSimple24: [LockSimpleIcon], magnifyingGlass24: [MagnifyingGlassIcon], mapPin24: [MapPinIcon], paperPlaneTilt24: [PaperPlaneTiltIcon],
  play24: [PlayIcon, "fill"], plus24: [PlusIcon], pushPin24: [PushPinIcon], rocketLaunch16: [RocketLaunchIcon, "fill"], sealCheck20: [SealCheckIcon, "fill"], share24: [ShareNetworkIcon], shield24: [ShieldIcon],
  shoppingCart24: [ShoppingCartIcon], slidersHorizontal24: [SlidersHorizontalIcon], speedometer24: [SpeedometerIcon], squaresFour24: [SquaresFourIcon],
  star16: [StarIcon, "fill"], tag24: [TagIcon], textIndent24: [TextIndentIcon], trash24: [TrashIcon], truck24: [TruckIcon], userCircle24: [UserCircleIcon],
  videoCamera24: [VideoCameraIcon], warning20: [WarningIcon], arrowDown24: [ArrowDownIcon], arrowUp24: [ArrowUpIcon], musicNotes24: [MusicNotesIcon],
  crown24: [CrownIcon, "fill"], globe24: [GlobeHemisphereWestIcon], trophy24: [TrophyIcon], prohibit24: [ProhibitIcon], userPlus24: [UserPlusIcon],
  at24: [AtIcon], envelope24: [EnvelopeSimpleIcon], eyeSlash24: [EyeSlashIcon], fileLock24: [FileLockIcon], flag24: [FlagIcon], hash24: [HashIcon], headset24: [HeadsetIcon],
  identification24: [IdentificationCardIcon], info24: [InfoIcon], lockKey24: [LockKeyIcon], phone24: [PhoneIcon], scales24: [ScalesIcon], shieldCheck24: [ShieldCheckIcon], shieldStar24: [ShieldStarIcon],
  signOut24: [SignOutIcon], trademark24: [TrademarkRegisteredIcon], userMinus24: [UserMinusIcon],
  note24: [FileTextIcon], package24: [PackageIcon], searchOff24: [MagnifyingGlassIcon], shoppingBag24: [ShoppingBagIcon], sparkle24: [SparkleIcon],
} as const satisfies Record<string, readonly [Icon] | readonly [Icon, IconWeight]>;

const brandIcons = { google24: "/icons/google24.svg" } as const;

export type AppIconName = keyof typeof phosphorIcons | keyof typeof brandIcons;

interface AppIconProps {
  readonly name: AppIconName;
  readonly size?: number;
  readonly className?: string;
}

export function AppIcon({ name, size = 24, className }: AppIconProps) {
  if (name in brandIcons) {
    return (
      <img
        src={brandIcons[name as keyof typeof brandIcons]}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={className ? `${styles.coloured} ${className}` : styles.coloured}
        style={{ width: size, height: size }}
      />
    );
  }

  const [PhosphorIcon, weight = "regular"] = phosphorIcons[name as keyof typeof phosphorIcons] as readonly [Icon, IconWeight?];
  return <PhosphorIcon size={size} weight={weight} aria-hidden="true" focusable="false" className={className ? `${styles.tinted} ${className}` : styles.tinted} />;
}

interface IconLabelProps {
  readonly name: AppIconName;
  readonly size?: number;
  readonly children: ReactNode;
  readonly className?: string;
}

export function IconLabel({ name, size = 14, children, className }: IconLabelProps) {
  return (
    <span className={className ? `${styles.iconLabel} ${className}` : styles.iconLabel}>
      <AppIcon name={name} size={size} />
      {children}
    </span>
  );
}

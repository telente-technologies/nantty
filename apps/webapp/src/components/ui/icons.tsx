import type { ReactNode, SVGProps } from "react";

import { AppIcon, type AppIconName } from "./appIcon";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  readonly size?: number;
}

function createIcon(render: (props: IconProps) => ReactNode) {
  return function Icon({ size = 22, className, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        {render({ size, className, ...rest })}
      </svg>
    );
  };
}

export const CompassIcon = createIcon(() => (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </>
));

export const ChevronLeftIcon = createIcon(() => <path d="M14.5 5.5 8 12l6.5 6.5" />);
export const PackageIcon = createIcon(() => (
  <>
    <path d="M20.5 7.8v8.4a1.6 1.6 0 0 1-.85 1.4l-7 3.7a1.6 1.6 0 0 1-1.5 0l-7-3.7a1.6 1.6 0 0 1-.85-1.4V7.8" />
    <path d="m3.7 7.4 7.65 4.05a1.8 1.8 0 0 0 1.6 0L20.6 7.4" />
    <path d="M12 21V11.6" />
    <path d="m3.5 7.65 8-4.25a1.6 1.6 0 0 1 1.5 0l8 4.25" />
  </>
));

export const SettingsIcon = createIcon(() => (
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.5 1.5 0 0 0 .3 1.65l.05.05a1.8 1.8 0 1 1-2.55 2.55l-.05-.05a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.9 1.37V20a1.8 1.8 0 0 1-3.6 0v-.1a1.5 1.5 0 0 0-.98-1.37 1.5 1.5 0 0 0-1.65.3l-.05.05A1.8 1.8 0 1 1 5.77 16.3l.05-.05a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.9H4.6a1.8 1.8 0 0 1 0-3.6h.1a1.5 1.5 0 0 0 1.37-.98 1.5 1.5 0 0 0-.3-1.65l-.05-.05A1.8 1.8 0 1 1 8.27 4.87l.05.05a1.5 1.5 0 0 0 1.65.3h.07a1.5 1.5 0 0 0 .9-1.37V3.6a1.8 1.8 0 0 1 3.6 0v.1a1.5 1.5 0 0 0 .9 1.37 1.5 1.5 0 0 0 1.65-.3l.05-.05a1.8 1.8 0 1 1 2.55 2.55l-.05.05a1.5 1.5 0 0 0-.3 1.65v.07a1.5 1.5 0 0 0 1.37.9h.15a1.8 1.8 0 0 1 0 3.6h-.1a1.5 1.5 0 0 0-1.37.9Z" />
  </>
));

export const LogOutIcon = createIcon(() => (
  <>
    <path d="M9.5 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h3.5" />
    <path d="m15 8.5 3.5 3.5L15 15.5" />
    <path d="M18.5 12H9" />
  </>
));

export const MailIcon = createIcon(() => (
  <>
    <rect x="2.5" y="5" width="19" height="14" rx="2.2" />
    <path d="m3.5 7 7.4 5.3a2 2 0 0 0 2.2 0L20.5 7" />
  </>
));

export const PhoneIcon = createIcon(() => (
  <path d="M7.6 3.5H5.3A1.8 1.8 0 0 0 3.5 5.4c.4 7.5 6.6 13.7 14.1 14.1a1.8 1.8 0 0 0 1.9-1.8v-2.3l-4-1.4-1.8 2a13.6 13.6 0 0 1-5.4-5.4l2-1.8-1.4-4Z" />
));

function createFigmaIcon(name: AppIconName) {
  return function FigmaIcon({ size = 22, className }: IconProps) {
    return <AppIcon name={name} size={size} className={className} />;
  };
}

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
export const BookmarkFilledIcon = createFigmaIcon("bookmarkSimpleFill24");
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

export const SunIcon = createIcon(() => (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </>
));

export const MoonIcon = createIcon(() => <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />);

export const MonitorIcon = createIcon(() => (
  <>
    <rect x="3" y="4" width="18" height="12.5" rx="2" />
    <path d="M8.5 20h7M12 16.5V20" />
  </>
));

export const TrendingIcon = createIcon(() => (
  <>
    <path d="m3.5 16.5 6-6 4 4 7-7" />
    <path d="M15 7.5h5.5V13" />
  </>
));

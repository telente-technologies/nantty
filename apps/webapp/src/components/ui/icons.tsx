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

export const ShieldIcon = createIcon(() => (
  <>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </>
));

export const DocumentIcon = createIcon(() => (
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </>
));

export const AlertIcon = createIcon(() => (
  <>
    <path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4M12 17h.01" />
  </>
));

export const ExternalLinkIcon = createIcon(() => (
  <>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </>
));

export const DownloadIcon = createIcon(() => (
  <>
    <path d="M12 4v11M7 10.5l5 5 5-5" />
    <path d="M5 19.5h14" />
  </>
));

const REPLY_BUBBLE_PATH = "M9.5 4.5h5a6 6 0 0 1 6 6v.4a6 6 0 0 1-6 6h-3.3l-4.05 3.05a.6.6 0 0 1-.96-.48v-2.98A6 6 0 0 1 3.5 10.9v-.4a6 6 0 0 1 6-6Z";
const HEART_PATH = "M12 19.8c-.3 0-7.6-4.5-8.8-9.3-.7-2.9 1.2-5.8 4.2-6 1.9-.1 3.5.9 4.6 2.6 1.1-1.7 2.7-2.7 4.6-2.6 3 .2 4.9 3.1 4.2 6-1.2 4.8-8.5 9.3-8.8 9.3Z";
const RIBBON_PATH = "M6.5 5.6a2.1 2.1 0 0 1 2.1-2.1h6.8a2.1 2.1 0 0 1 2.1 2.1v14.2a.6.6 0 0 1-.95.49L12 17.05l-4.55 3.24a.6.6 0 0 1-.95-.49Z";

export const ReplyActionIcon = createIcon(() => <path d={REPLY_BUBBLE_PATH} />);
export const RepostActionIcon = createIcon(() => (
  <>
    <path d="M4.5 11V9.2a3 3 0 0 1 3-3h11.3M15.6 3l3.2 3.2-3.2 3.2" />
    <path d="M19.5 13v1.8a3 3 0 0 1-3 3H5.2M8.4 21l-3.2-3.2 3.2-3.2" />
  </>
));
export const LikeActionIcon = createIcon(() => <path d={HEART_PATH} />);
export const LikeFilledActionIcon = createIcon(() => <path d={HEART_PATH} fill="currentColor" />);
export const ViewsActionIcon = createIcon(() => <path d="M4.5 19.5v-5M9.5 19.5V9M14.5 19.5V12M19.5 19.5V4.5" />);
export const BookmarkActionIcon = createIcon(() => <path d={RIBBON_PATH} />);
export const BookmarkFilledActionIcon = createIcon(() => <path d={RIBBON_PATH} fill="currentColor" />);
export const ShareActionIcon = createIcon(() => (
  <path d="M12 14.5V3.8M7.9 7.7 12 3.6l4.1 4.1M4.5 13.5v4.6a2.4 2.4 0 0 0 2.4 2.4h10.2a2.4 2.4 0 0 0 2.4-2.4v-4.6" />
));
export const SendActionIcon = createIcon(() => (
  <path d="M20.6 3.6 10.3 13.9M20.6 3.6 14.4 20.1a.5.5 0 0 1-.92.04l-3.18-6.24-6.24-3.18a.5.5 0 0 1 .04-.92Z" />
));
export const GiftActionIcon = createIcon(() => (
  <>
    <path d="M4.8 9.2h14.4a.8.8 0 0 1 .8.8v2.6a.8.8 0 0 1-.8.8H4.8a.8.8 0 0 1-.8-.8V10a.8.8 0 0 1 .8-.8ZM5.5 13.4v5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-5M12 9.2v11.2" />
    <path d="M12 9.2C10.7 5.9 7 5 7 7.3c0 1.3 1.8 1.9 5 1.9ZM12 9.2c1.3-3.3 5-4.2 5-1.9 0 1.3-1.8 1.9-5 1.9Z" />
  </>
));

export const PersonTagIcon = createIcon(() => (
  <>
    <circle cx="10" cy="7.5" r="3.75" />
    <path d="M3.25 20c.6-3.7 3.3-6 6.75-6 1.2 0 2.3.28 3.25.8" />
    <path d="M15.5 15.25h3.6l2.15 2.4-2.15 2.4h-3.6a.9.9 0 0 1-.9-.9v-3a.9.9 0 0 1 .9-.9Z" />
  </>
));

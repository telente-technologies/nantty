import type { ReactNode, SVGProps } from "react";

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

export const HomeIcon = createIcon(() => (
  <>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.5a1 1 0 0 0 1-1V9.5" />
  </>
));

export const CompassIcon = createIcon(() => (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </>
));

export const CartIcon = createIcon(() => (
  <>
    <path d="M2.5 4h2.2l2.1 10.4a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.55L20.5 8H6" />
    <circle cx="9.5" cy="20" r="1.4" />
    <circle cx="17.5" cy="20" r="1.4" />
  </>
));

export const ChatIcon = createIcon(() => (
  <path d="M20.5 11.5c0 4-3.8 7.2-8.5 7.2-1 0-2-.15-2.9-.42L4.5 20l1.2-3.3A6.9 6.9 0 0 1 3.5 11.5c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2Z" />
));

export const UserIcon = createIcon(() => (
  <>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.8 20.2c.7-3.4 3.7-5.4 7.2-5.4s6.5 2 7.2 5.4" />
  </>
));

export const BellIcon = createIcon(() => (
  <>
    <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5Z" />
    <path d="M10.3 19a2 2 0 0 0 3.4 0" />
  </>
));

export const SearchIcon = createIcon(() => (
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </>
));

export const HeartIcon = createIcon(() => (
  <path d="M12 20.2s-7.6-4.6-7.6-9.8A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.6 3c0 5.2-7.6 9.8-7.6 9.8Z" />
));

export const StarIcon = createIcon(() => <path d="m12 3.6 2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85L12 3.6Z" />);

export const ChevronRightIcon = createIcon(() => <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />);
export const ChevronLeftIcon = createIcon(() => <path d="M14.5 5.5 8 12l6.5 6.5" />);
export const ChevronDownIcon = createIcon(() => <path d="m5.5 9 6.5 6.5L18.5 9" />);

export const ArrowLeftIcon = createIcon(() => (
  <>
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </>
));

export const PlusIcon = createIcon(() => (
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>
));

export const CloseIcon = createIcon(() => (
  <>
    <path d="m6 6 12 12" />
    <path d="m18 6-12 12" />
  </>
));

export const ShareIcon = createIcon(() => (
  <>
    <circle cx="18" cy="5.5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="18.5" r="2.5" />
    <path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" />
  </>
));

export const MoreIcon = createIcon(() => (
  <>
    <circle cx="5.5" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="18.5" cy="12" r="1.4" />
  </>
));

export const CheckIcon = createIcon(() => <path d="m5 12.8 4.5 4.4L19 7.5" />);

export const TrashIcon = createIcon(() => (
  <>
    <path d="M4.5 7h15" />
    <path d="M9.5 7V5.2a1.2 1.2 0 0 1 1.2-1.2h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
    <path d="M6.5 7 7.4 19.2A1.8 1.8 0 0 0 9.2 21h5.6a1.8 1.8 0 0 0 1.8-1.8L17.5 7" />
  </>
));

export const StoreIcon = createIcon(() => (
  <>
    <path d="M4 9.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19V9.5" />
    <path d="M3.2 9.5 5 4.2A1 1 0 0 1 5.96 3.5h12.08a1 1 0 0 1 .96.7l1.8 5.3" />
    <path d="M3.2 9.5a2.4 2.4 0 0 0 4.7 0 2.4 2.4 0 0 0 4.2 0 2.4 2.4 0 0 0 4.2 0 2.4 2.4 0 0 0 4.7 0" />
    <path d="M9.5 20.5V15h5v5.5" />
  </>
));

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

export const FilterIcon = createIcon(() => (
  <>
    <path d="M4 6.5h16" />
    <path d="M7 12h10" />
    <path d="M10 17.5h4" />
  </>
));

export const CreditCardIcon = createIcon(() => (
  <>
    <rect x="2.5" y="5.5" width="19" height="13" rx="2.2" />
    <path d="M2.5 10h19" />
    <path d="M6.5 14.5h3" />
  </>
));

export const MapPinIcon = createIcon(() => (
  <>
    <path d="M19 10.3c0 5-7 11-7 11s-7-6-7-11a7 7 0 1 1 14 0Z" />
    <circle cx="12" cy="10.2" r="2.6" />
  </>
));

export const ImageIcon = createIcon(() => (
  <>
    <rect x="3" y="4.5" width="18" height="15" rx="2.2" />
    <circle cx="8.7" cy="9.7" r="1.7" />
    <path d="m4 17.5 4.8-4.4a2 2 0 0 1 2.7 0L20 20" />
  </>
));

export const EyeIcon = createIcon(() => (
  <>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>
));

export const LockIcon = createIcon(() => (
  <>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
    <path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" />
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

export const TagIcon = createIcon(() => (
  <>
    <path d="M3.5 11.4V5a1.5 1.5 0 0 1 1.5-1.5h6.4a2 2 0 0 1 1.4.6l7.1 7.1a2 2 0 0 1 0 2.8l-6.4 6.4a2 2 0 0 1-2.8 0L4.1 12.8a2 2 0 0 1-.6-1.4Z" />
    <circle cx="8" cy="8" r="1.4" />
  </>
));

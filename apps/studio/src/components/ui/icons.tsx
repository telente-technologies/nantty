import {
  ArrowLeftIcon as PhArrowLeft, BellIcon as PhBell, CaretDownIcon, CaretLeftIcon, CaretRightIcon, ChatCircleIcon, CheckIcon as PhCheck,
  CompassIcon as PhCompass, CreditCardIcon as PhCreditCard, DotsThreeIcon, EnvelopeIcon, EyeIcon as PhEye, FunnelSimpleIcon, GearIcon,
  HeartIcon as PhHeart, HouseIcon, ImageIcon as PhImage, LockIcon as PhLock, MagnifyingGlassIcon, MapPinIcon as PhMapPin,
  PackageIcon as PhPackage, PhoneIcon as PhPhone, PlusIcon as PhPlus, ShareNetworkIcon, ShoppingCartIcon, SignOutIcon, StarIcon as PhStar,
  StorefrontIcon, TagIcon as PhTag, TrashIcon as PhTrash, UserIcon as PhUser, XIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon, IconProps as PhosphorIconProps } from "@phosphor-icons/react";

export type IconProps = Omit<PhosphorIconProps, "children" | "ref">;

function createIcon(PhosphorIcon: Icon) {
  return function AppGlyph({ size = 22, ...rest }: IconProps) {
    return <PhosphorIcon size={size} aria-hidden="true" focusable="false" {...rest} />;
  };
}

export const HomeIcon = createIcon(HouseIcon);
export const CompassIcon = createIcon(PhCompass);
export const CartIcon = createIcon(ShoppingCartIcon);
export const ChatIcon = createIcon(ChatCircleIcon);
export const UserIcon = createIcon(PhUser);
export const BellIcon = createIcon(PhBell);
export const SearchIcon = createIcon(MagnifyingGlassIcon);
export const HeartIcon = createIcon(PhHeart);
export const StarIcon = createIcon(PhStar);
export const ChevronRightIcon = createIcon(CaretRightIcon);
export const ChevronLeftIcon = createIcon(CaretLeftIcon);
export const ChevronDownIcon = createIcon(CaretDownIcon);
export const ArrowLeftIcon = createIcon(PhArrowLeft);
export const PlusIcon = createIcon(PhPlus);
export const CloseIcon = createIcon(XIcon);
export const ShareIcon = createIcon(ShareNetworkIcon);
export const MoreIcon = createIcon(DotsThreeIcon);
export const CheckIcon = createIcon(PhCheck);
export const TrashIcon = createIcon(PhTrash);
export const StoreIcon = createIcon(StorefrontIcon);
export const PackageIcon = createIcon(PhPackage);
export const SettingsIcon = createIcon(GearIcon);
export const LogOutIcon = createIcon(SignOutIcon);
export const FilterIcon = createIcon(FunnelSimpleIcon);
export const CreditCardIcon = createIcon(PhCreditCard);
export const MapPinIcon = createIcon(PhMapPin);
export const ImageIcon = createIcon(PhImage);
export const EyeIcon = createIcon(PhEye);
export const LockIcon = createIcon(PhLock);
export const MailIcon = createIcon(EnvelopeIcon);
export const PhoneIcon = createIcon(PhPhone);
export const TagIcon = createIcon(PhTag);

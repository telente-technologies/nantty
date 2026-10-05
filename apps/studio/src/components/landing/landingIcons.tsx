import {
  ArrowRightIcon, ArrowsClockwiseIcon, BankIcon, BookOpenIcon, CaretLeftIcon, CaretRightIcon, ChartLineUpIcon, ChatIcon, CheckIcon, CoinsIcon,
  CrownIcon, DeviceMobileIcon, EyeIcon, FilmStripIcon, GameControllerIcon, GiftIcon, HeartIcon, LightningIcon, MapPinIcon, MegaphoneIcon,
  MicrophoneIcon, MonitorIcon, MusicNotesIcon, PlusIcon, SealCheckIcon, ShieldCheckIcon, ShoppingBagIcon, StackIcon, StarIcon, TrophyIcon,
  UsersIcon, WifiHighIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon, IconWeight } from "@phosphor-icons/react";

const phosphorIcons = {
  check: CheckIcon, arrowRight: ArrowRightIcon, chevronLeft: CaretLeftIcon, chevronRight: CaretRightIcon, plus: PlusIcon, phone: DeviceMobileIcon,
  monitor: MonitorIcon, users: UsersIcon, gift: GiftIcon, bolt: LightningIcon, layers: StackIcon, shield: ShieldCheckIcon, trophy: TrophyIcon,
  film: FilmStripIcon, chart: ChartLineUpIcon, sealCheck: SealCheckIcon, bank: BankIcon, coins: CoinsIcon, star: StarIcon, megaphone: MegaphoneIcon,
  mic: MicrophoneIcon, gamepad: GameControllerIcon, book: BookOpenIcon, mapPin: MapPinIcon, music: MusicNotesIcon, bag: ShoppingBagIcon,
  crown: CrownIcon, heart: HeartIcon, eye: EyeIcon, chat: ChatIcon, wifi: WifiHighIcon, rotate: ArrowsClockwiseIcon,
} satisfies Record<string, Icon>;

export type LandingIconName = keyof typeof phosphorIcons | "drum";

function weightForStroke(strokeWidth: number): IconWeight {
  if (strokeWidth < 1.5) return "light";
  return strokeWidth < 2 ? "regular" : "bold";
}

export function LandingIcon({ name, size = 20, className, strokeWidth = 1.8 }: { readonly name: LandingIconName; readonly size?: number; readonly className?: string; readonly strokeWidth?: number }) {
  if (name === "drum") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
        <path d="M7 3.5h10l-3.2 8.5 3.2 8.5H7l3.2-8.5L7 3.5Z" />
        <path d="M9.2 5.5 14 18.5M14.8 5.5 10 18.5" />
      </svg>
    );
  }
  const PhosphorIcon = phosphorIcons[name];
  return <PhosphorIcon size={size} weight={weightForStroke(strokeWidth)} className={className} aria-hidden="true" focusable="false" />;
}

import type { Icon, IconWeight } from "phosphor-react-native";

import type { ErrorIconName } from "@/errors/errorExperience/errorKinds";

import {
  ArrowCircleUpIcon, ArrowsClockwiseIcon, BellIcon, BroadcastIcon, BrowserIcon, BugIcon, CameraIcon, ChartLineIcon, ChatsCircleIcon, CheckCircleIcon, CheckIcon, ClockCounterClockwiseIcon, ClockIcon,
  CloudSlashIcon, CodeBlockIcon, CompassIcon, CookieIcon, CopyIcon, CopyrightIcon, CreditCardIcon, CrownIcon, DatabaseIcon, EnvelopeIcon, EnvelopeOpenIcon, EyeSlashIcon, FileXIcon, FilmStripIcon,
  GaugeIcon, GhostIcon, GlobeHemisphereWestIcon, HourglassIcon, HouseIcon, ImageBrokenIcon, LinkBreakIcon, LockKeyIcon, MagnifyingGlassIcon, MagnifyingGlassMinusIcon, MapPinIcon, MapTrifoldIcon,
  MegaphoneIcon, MicrophoneIcon, PackageIcon, PlayCircleIcon, ProhibitIcon, QuestionIcon, ReceiptIcon, ReceiptXIcon, RobotIcon, SealCheckIcon, ShieldCheckIcon, ShieldWarningIcon, ShoppingCartIcon,
  SignInIcon, SquaresFourIcon, StorefrontIcon, TimerIcon, TrashIcon, TruckIcon, UploadSimpleIcon, UserCircleMinusIcon, UsersIcon, VideoCameraSlashIcon, WalletIcon, WarningIcon, WifiSlashIcon,
  WrenchIcon,
} from "./phosphorGlyphs";

export const errorIconRegistry: Readonly<Record<ErrorIconName, Icon>> = {
  warning: WarningIcon, bug: BugIcon, wifiSlash: WifiSlashIcon, cloudSlash: CloudSlashIcon, hourglass: HourglassIcon, timer: TimerIcon, magnifyingGlass: MagnifyingGlassIcon,
  mapTrifold: MapTrifoldIcon, trash: TrashIcon, ghost: GhostIcon, lockKey: LockKeyIcon, prohibit: ProhibitIcon, signIn: SignInIcon, shieldWarning: ShieldWarningIcon, shieldCheck: ShieldCheckIcon,
  sealCheck: SealCheckIcon, gauge: GaugeIcon, wrench: WrenchIcon, creditCard: CreditCardIcon, wallet: WalletIcon, globe: GlobeHemisphereWestIcon, userMinus: UserCircleMinusIcon,
  arrowCircleUp: ArrowCircleUpIcon, camera: CameraIcon, microphone: MicrophoneIcon, mapPin: MapPinIcon, imageBroken: ImageBrokenIcon, filmSlash: FilmStripIcon, videoCameraSlash: VideoCameraSlashIcon,
  linkBreak: LinkBreakIcon, envelope: EnvelopeIcon, envelopeOpen: EnvelopeOpenIcon, copyright: CopyrightIcon, eyeSlash: EyeSlashIcon, receipt: ReceiptIcon, storefront: StorefrontIcon,
  package: PackageIcon, truck: TruckIcon, shoppingCart: ShoppingCartIcon, clockCounterClockwise: ClockCounterClockwiseIcon, crown: CrownIcon, database: DatabaseIcon, fileX: FileXIcon,
  uploadSimple: UploadSimpleIcon, checkCircle: CheckCircleIcon, arrowsClockwise: ArrowsClockwiseIcon, browser: BrowserIcon, cookie: CookieIcon, clock: ClockIcon, robot: RobotIcon,
  codeBlock: CodeBlockIcon, question: QuestionIcon, chatsCircle: ChatsCircleIcon, magnifyingGlassMinus: MagnifyingGlassMinusIcon, bell: BellIcon, receiptX: ReceiptXIcon,
  squaresFour: SquaresFourIcon, playCircle: PlayCircleIcon, chartLine: ChartLineIcon, megaphone: MegaphoneIcon, users: UsersIcon, house: HouseIcon, compass: CompassIcon, broadcast: BroadcastIcon,
};

export function ErrorGlyph({ name, size = 28, color, weight = "duotone" }: { readonly name: ErrorIconName; readonly size?: number; readonly color: string; readonly weight?: IconWeight }) {
  const Glyph = errorIconRegistry[name] ?? WarningIcon;
  return <Glyph size={size} color={color} weight={weight} />;
}

export function CopyGlyph({ copied, size = 14, color }: { readonly copied: boolean; readonly size?: number; readonly color: string }) {
  const Glyph = copied ? CheckIcon : CopyIcon;
  return <Glyph size={size} color={color} weight={copied ? "bold" : "regular"} />;
}

export function SearchGlyph({ size = 18, color }: { readonly size?: number; readonly color: string }) {
  return <MagnifyingGlassIcon size={size} color={color} weight="bold" />;
}

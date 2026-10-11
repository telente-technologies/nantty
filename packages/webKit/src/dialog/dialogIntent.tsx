/** @jsxRuntime automatic */
/** @jsxImportSource react */
import {
  ArchiveIcon, ArrowCounterClockwiseIcon, ArrowsLeftRightIcon, ArrowUUpLeftIcon, BankIcon, BellSlashIcon, BroadcastIcon, CalendarDotsIcon, CameraIcon, ChartBarHorizontalIcon, ChartLineUpIcon,
  ChatCircleTextIcon, CheckCircleIcon, ClipboardTextIcon, CoinsIcon, CopyrightIcon, CreditCardIcon, CrownIcon, CurrencyNgnIcon, EyeIcon, FingerprintIcon, FlagIcon, FlaskIcon,
  GearSixIcon, GiftIcon, HandPalmIcon, HandshakeIcon, InfoIcon, KeyIcon, LightningIcon, LinkIcon, LockKeyIcon, MapPinIcon, MegaphoneIcon, MicrophoneIcon, PackageIcon, PaperclipIcon, PaperPlaneTiltIcon,
  PencilSimpleIcon, PercentIcon, PlusCircleIcon, ProhibitIcon, ReceiptIcon, RepeatIcon, RocketLaunchIcon, ScalesIcon, ScrollIcon, SealCheckIcon, ShareFatIcon, ShieldCheckIcon,
  ShieldWarningIcon, SignInIcon, SignOutIcon, StarIcon, StopCircleIcon, StorefrontIcon, TagIcon, TrashIcon, TruckIcon, UploadSimpleIcon, UserMinusIcon, UserPlusIcon,
  UsersThreeIcon, WalletIcon, WarehouseIcon, WarningCircleIcon, WarningIcon, WarningOctagonIcon, WebhooksLogoIcon, XCircleIcon, XIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

export type DialogTone = "neutral" | "brand" | "danger" | "success" | "caution";

const intentTable = {
  info: [InfoIcon, "neutral"],
  success: [CheckCircleIcon, "success"],
  warning: [WarningIcon, "caution"],
  danger: [WarningOctagonIcon, "danger"],
  delete: [TrashIcon, "danger"],
  deleteAccount: [WarningOctagonIcon, "danger"],
  remove: [XCircleIcon, "danger"],
  archive: [ArchiveIcon, "caution"],
  cancel: [XCircleIcon, "caution"],
  stop: [StopCircleIcon, "caution"],
  restore: [ArrowUUpLeftIcon, "brand"],
  unfollow: [UserMinusIcon, "danger"],
  removeMember: [UserMinusIcon, "danger"],
  addMember: [UserPlusIcon, "brand"],
  team: [UsersThreeIcon, "brand"],
  block: [ProhibitIcon, "danger"],
  suspend: [HandPalmIcon, "danger"],
  report: [FlagIcon, "caution"],
  moderation: [ShieldWarningIcon, "caution"],
  signIn: [SignInIcon, "brand"],
  signOut: [SignOutIcon, "brand"],
  leave: [SignOutIcon, "danger"],
  security: [ShieldCheckIcon, "brand"],
  stepUp: [ShieldCheckIcon, "brand"],
  passkey: [FingerprintIcon, "brand"],
  key: [KeyIcon, "brand"],
  lock: [LockKeyIcon, "brand"],
  verify: [SealCheckIcon, "brand"],
  mute: [BellSlashIcon, "neutral"],
  share: [ShareFatIcon, "brand"],
  reshare: [RepeatIcon, "brand"],
  link: [LinkIcon, "caution"],
  boost: [RocketLaunchIcon, "brand"],
  camera: [CameraIcon, "brand"],
  location: [MapPinIcon, "brand"],
  microphone: [MicrophoneIcon, "brand"],
  attachment: [PaperclipIcon, "brand"],
  poll: [ChartBarHorizontalIcon, "brand"],
  money: [WalletIcon, "brand"],
  naira: [CurrencyNgnIcon, "brand"],
  bank: [BankIcon, "brand"],
  card: [CreditCardIcon, "brand"],
  coins: [CoinsIcon, "brand"],
  refund: [ArrowCounterClockwiseIcon, "caution"],
  dispute: [ScalesIcon, "caution"],
  receipt: [ReceiptIcon, "brand"],
  subscribe: [CrownIcon, "brand"],
  gift: [GiftIcon, "brand"],
  message: [ChatCircleTextIcon, "brand"],
  send: [PaperPlaneTiltIcon, "brand"],
  publish: [PaperPlaneTiltIcon, "brand"],
  schedule: [CalendarDotsIcon, "brand"],
  upload: [UploadSimpleIcon, "brand"],
  edit: [PencilSimpleIcon, "brand"],
  create: [PlusCircleIcon, "brand"],
  store: [StorefrontIcon, "brand"],
  product: [PackageIcon, "brand"],
  inventory: [WarehouseIcon, "brand"],
  transfer: [ArrowsLeftRightIcon, "brand"],
  delivery: [TruckIcon, "brand"],
  tag: [TagIcon, "brand"],
  discount: [PercentIcon, "brand"],
  review: [StarIcon, "brand"],
  partner: [HandshakeIcon, "brand"],
  ads: [MegaphoneIcon, "brand"],
  audience: [UsersThreeIcon, "brand"],
  rule: [LightningIcon, "brand"],
  experiment: [FlaskIcon, "brand"],
  analytics: [ChartLineUpIcon, "brand"],
  live: [BroadcastIcon, "brand"],
  copyright: [CopyrightIcon, "caution"],
  legal: [ScrollIcon, "brand"],
  settings: [GearSixIcon, "neutral"],
  webhook: [WebhooksLogoIcon, "brand"],
  notes: [ClipboardTextIcon, "brand"],
  views: [EyeIcon, "brand"],
  error: [WarningCircleIcon, "caution"],
} as const satisfies Record<string, readonly [Icon, DialogTone]>;

export type DialogIntent = keyof typeof intentTable;

export const dialogIntents = Object.keys(intentTable) as DialogIntent[];

export function dialogIntentTone(intent: DialogIntent): DialogTone {
  return intentTable[intent][1];
}

export function DialogIntentIcon({ intent, size = 26 }: { readonly intent: DialogIntent; readonly size?: number }) {
  const Glyph = intentTable[intent][0];
  return <Glyph size={size} weight="bold" aria-hidden="true" focusable="false" />;
}

export function DialogCloseGlyph({ size = 18 }: { readonly size?: number }) {
  return <XIcon size={size} weight="bold" aria-hidden="true" focusable="false" />;
}

export function DialogErrorGlyph({ size = 18 }: { readonly size?: number }) {
  return <WarningCircleIcon size={size} weight="bold" aria-hidden="true" focusable="false" />;
}

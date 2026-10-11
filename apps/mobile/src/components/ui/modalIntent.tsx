import type { ComponentType } from "react";

import {
  Bank24Icon, Camera24Icon, CheckCircle24Icon, Crown24Icon, CurrencyNgn24Icon, Document24Icon, Flag24Icon, Flame24Icon, Image24Icon, Info24Icon, Link24Icon, LockKey24Icon,
  MapPin24Icon, Microphone24Icon, Paperclip24Icon, PaperPlaneTilt24Icon, Prohibit24Icon, PushPin24Icon, RocketLaunch24Icon, SealCheck24Icon, ShareFat24Icon, ShieldCheck24Icon, SignIn24Icon,
  SignOut24Icon, StopCircle24Icon, Swords24Icon, Trash24Icon, UserMinus24Icon, VideoCamera24Icon, Wallet24Icon, WarningOctagon24Icon, BellSlash24Icon, ChatCircle24Icon,
  Warning20Icon, WifiSlash24Icon, XCircle24Icon, type IconProps,
} from "@/components/icons";

import type { ModalTone } from "./modalChrome.constant";

const intentTable = {
  info: [Info24Icon, "neutral"],
  success: [CheckCircle24Icon, "success"],
  warning: [Warning20Icon, "caution"],
  error: [Warning20Icon, "caution"],
  danger: [WarningOctagon24Icon, "destructive"],
  delete: [Trash24Icon, "destructive"],
  deleteAccount: [WarningOctagon24Icon, "destructive"],
  remove: [XCircle24Icon, "destructive"],
  unfollow: [UserMinus24Icon, "destructive"],
  removeMember: [UserMinus24Icon, "destructive"],
  block: [Prohibit24Icon, "destructive"],
  report: [Flag24Icon, "caution"],
  signIn: [SignIn24Icon, "brand"],
  signOut: [SignOut24Icon, "brand"],
  leave: [SignOut24Icon, "destructive"],
  stepUp: [ShieldCheck24Icon, "brand"],
  security: [ShieldCheck24Icon, "brand"],
  verify: [SealCheck24Icon, "brand"],
  lock: [LockKey24Icon, "brand"],
  mute: [BellSlash24Icon, "neutral"],
  share: [ShareFat24Icon, "brand"],
  link: [Link24Icon, "caution"],
  boost: [RocketLaunch24Icon, "brand"],
  camera: [Camera24Icon, "brand"],
  microphone: [Microphone24Icon, "brand"],
  location: [MapPin24Icon, "brand"],
  money: [Wallet24Icon, "brand"],
  naira: [CurrencyNgn24Icon, "brand"],
  bank: [Bank24Icon, "brand"],
  subscribe: [Crown24Icon, "brand"],
  live: [VideoCamera24Icon, "brand"],
  stop: [StopCircle24Icon, "destructive"],
  battle: [Swords24Icon, "caution"],
  pin: [PushPin24Icon, "brand"],
  media: [Image24Icon, "caution"],
  file: [Document24Icon, "brand"],
  attachment: [Paperclip24Icon, "caution"],
  message: [ChatCircle24Icon, "brand"],
  send: [PaperPlaneTilt24Icon, "brand"],
  streak: [Flame24Icon, "caution"],
  offline: [WifiSlash24Icon, "caution"],
} as const satisfies Record<string, readonly [ComponentType<IconProps>, ModalTone]>;

export type ModalIntent = keyof typeof intentTable;

export const modalIntents = Object.keys(intentTable) as ModalIntent[];

export function modalIntentTone(intent: ModalIntent): ModalTone {
  return intentTable[intent][1];
}

export function ModalIntentIcon({ intent, color, size = 24 }: { readonly intent: ModalIntent; readonly color: string; readonly size?: number }) {
  const Glyph = intentTable[intent][0];
  return <Glyph size={size} color={color} />;
}

export function inferModalIntent(tone: ModalTone): ModalIntent | undefined {
  if (tone === "destructive") return "danger";
  if (tone === "caution") return "error";
  if (tone === "success") return "success";
  return undefined;
}

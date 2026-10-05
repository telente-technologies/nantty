import type { Icon, IconWeight } from "@phosphor-icons/react";
import {
  AppleLogo, ArrowLeft, ArrowsClockwise, ArrowUpRight, Bell, BoxArrowDown, Camera, CaretDown, ChatCircle, Check,
  CreditCard, EyeClosed, Gauge, Headset, Heart, ImageSquare, MagnifyingGlass, MapPin, Minus, PaperPlaneTilt, Play,
  Plus, SealCheck, Shield, SquaresFour, Star, Storefront, Tag, TextIndent, Truck, UserCircle, VideoCamera, Warning, X,
} from "@phosphor-icons/react/dist/ssr";

import styles from "./figmaIcon.module.css";

const iconsByName = {
  apple24: [AppleLogo],
  arrowLeft24: [ArrowLeft],
  arrowUpRight24: [ArrowUpRight],
  bell24: [Bell],
  boxArrowDown24: [BoxArrowDown],
  buildingStore20: [Storefront],
  cameraBolt24: [Camera],
  cancel20: [X],
  caretDown24: [CaretDown],
  chatCircle24: [ChatCircle],
  check16: [Check],
  creditCard24: [CreditCard],
  eyeClosed20: [EyeClosed],
  headset24: [Headset],
  heart24: [Heart],
  imageSquare24: [ImageSquare],
  magnifyingGlass24: [MagnifyingGlass],
  mapPin24: [MapPin],
  minus16: [Minus],
  paperPlaneTilt24: [PaperPlaneTilt],
  play24: [Play, "fill"],
  plus16: [Plus],
  refresh20: [ArrowsClockwise],
  sealCheck20: [SealCheck, "fill"],
  shield24: [Shield],
  speedometer24: [Gauge],
  squaresFour24: [SquaresFour],
  star16: [Star, "fill"],
  tag24: [Tag],
  textIndent24: [TextIndent],
  truck24: [Truck],
  userCircle24: [UserCircle],
  videoCamera24: [VideoCamera],
  warning20: [Warning],
} as const satisfies Record<string, readonly [Icon] | readonly [Icon, IconWeight]>;

export type FigmaIconName = keyof typeof iconsByName;

interface FigmaIconProps {
  readonly name: FigmaIconName;
  readonly size?: number;
  readonly className?: string;
}

export function FigmaIconTintedWithCurrentColor({ name, size = 24, className }: FigmaIconProps) {
  const [PhosphorIcon, weight = "regular"] = iconsByName[name] as readonly [Icon, IconWeight?];
  return <PhosphorIcon aria-hidden="true" focusable="false" size={size} weight={weight} className={className ? `${styles.icon} ${className}` : styles.icon} />;
}

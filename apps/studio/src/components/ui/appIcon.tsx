import { AppleLogoIcon, ArrowLeftIcon, CheckIcon, SealCheckIcon, ShieldIcon, TruckIcon, UserCircleIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";
import type { Icon, IconWeight } from "@phosphor-icons/react";

import styles from "./appIcon.module.css";

const phosphorIcons = {
  apple24: [AppleLogoIcon, "fill"],
  arrowLeft24: [ArrowLeftIcon],
  check16: [CheckIcon],
  sealCheck20: [SealCheckIcon, "fill"],
  shield24: [ShieldIcon],
  truck24: [TruckIcon],
  userCircle24: [UserCircleIcon],
  warning20: [WarningIcon],
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

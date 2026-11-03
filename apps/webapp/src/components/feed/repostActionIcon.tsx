import { ArrowsClockwiseIcon } from "@phosphor-icons/react/dist/ssr";
import type { IconProps as PhosphorIconProps, IconWeight } from "@phosphor-icons/react";

type IconProps = Omit<PhosphorIconProps, "children" | "ref">;

export function RepostActionIcon({ size = 22, weight = "regular", ...rest }: IconProps) {
  return <ArrowsClockwiseIcon size={size} weight={weight as IconWeight} aria-hidden="true" focusable="false" {...rest} />;
}

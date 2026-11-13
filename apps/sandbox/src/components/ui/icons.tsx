import {
  ChartLineUpIcon as PhChartLineUp,
  ClockIcon as PhClock,
  CodeIcon as PhCode,
  PlayIcon as PhPlay,
  QuestionIcon as PhQuestion,
  ShareNetworkIcon as PhShare,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon, IconProps as PhosphorIconProps } from "@phosphor-icons/react";

export type IconProps = Omit<PhosphorIconProps, "children" | "ref">;

function createIcon(IconComponent: Icon) {
  return function AppIcon({ size = 20, ...props }: IconProps) {
    return <IconComponent size={size} aria-hidden="true" focusable="false" {...props} />;
  };
}

export const ActivityIcon = createIcon(PhChartLineUp);
export const ClockIcon = createIcon(PhClock);
export const CodeIcon = createIcon(PhCode);
export const HelpIcon = createIcon(PhQuestion);
export const PlayIcon = createIcon(PhPlay);
export const ShareIcon = createIcon(PhShare);

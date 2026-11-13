import {
  ChartLineUpIcon as PhChartLineUp,
  CodeIcon as PhCode,
  LockIcon as PhLock,
  QuestionIcon as PhQuestion,
  ShareNetworkIcon as PhShare,
  WalletIcon as PhWallet,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon, IconProps as PhosphorIconProps } from "@phosphor-icons/react";

export type IconProps = Omit<PhosphorIconProps, "children" | "ref">;

function createIcon(IconComponent: Icon) {
  return function AppIcon({ size = 20, ...props }: IconProps) {
    return <IconComponent size={size} aria-hidden="true" focusable="false" {...props} />;
  };
}

export const ActivityIcon = createIcon(PhChartLineUp);
export const CodeIcon = createIcon(PhCode);
export const HelpIcon = createIcon(PhQuestion);
export const LockIcon = createIcon(PhLock);
export const ShareIcon = createIcon(PhShare);
export const WalletIcon = createIcon(PhWallet);

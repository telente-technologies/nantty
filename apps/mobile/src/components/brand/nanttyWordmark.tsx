import { Image } from "react-native";
import type { NanttyWordmarkVariant } from "@nantty/web-kit/brandPath";

export type NanttyWordmarkTone = "brand" | "mono";

export interface NanttyWordmarkProps {
  readonly height?: number;
  readonly tone?: NanttyWordmarkTone;
  readonly variant?: NanttyWordmarkVariant;
}

const nanttyIcon = require("../../../assets/nantty-icon.png");

export function NanttyWordmark({ height = 24 }: NanttyWordmarkProps) {
  return <Image source={nanttyIcon} style={{ width: height, height }} resizeMode="contain" accessibilityRole="image" accessibilityLabel="Nantty" />;
}

export function NanttyLogoMark({ size = 26 }: { readonly size?: number }) {
  return <Image source={nanttyIcon} style={{ width: size, height: size }} resizeMode="contain" accessibilityRole="image" accessibilityLabel="Nantty" />;
}

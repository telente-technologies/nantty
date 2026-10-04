import type { ReactNode } from "react";
import Svg, { Path } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

const ACTION_STROKE_WIDTH = 1.8;

const REPLY_BUBBLE = "M9.5 4.5h5a6 6 0 0 1 6 6v.4a6 6 0 0 1-6 6h-3.3l-4.05 3.05a.6.6 0 0 1-.96-.48v-2.98A6 6 0 0 1 3.5 10.9v-.4a6 6 0 0 1 6-6Z";
const HEART = "M12 19.8c-.3 0-7.6-4.5-8.8-9.3-.7-2.9 1.2-5.8 4.2-6 1.9-.1 3.5.9 4.6 2.6 1.1-1.7 2.7-2.7 4.6-2.6 3 .2 4.9 3.1 4.2 6-1.2 4.8-8.5 9.3-8.8 9.3Z";
const RIBBON = "M6.5 5.6a2.1 2.1 0 0 1 2.1-2.1h6.8a2.1 2.1 0 0 1 2.1 2.1v14.2a.6.6 0 0 1-.95.49L12 17.05l-4.55 3.24a.6.6 0 0 1-.95-.49Z";

function StrokeGlyph({ size, color, style, children }: IconProps & { readonly children: (ink: string) => ReactNode }) {
  const themedInk = useThemedIconInk("#000000");
  const ink = color ?? themedInk;
  const edge = size ?? 24;
  return (
    <Svg width={edge} height={edge} viewBox="0 0 24 24" fill="none" style={style}>
      {children(ink)}
    </Svg>
  );
}

const stroked = (ink: string) =>
  ({ stroke: ink, strokeWidth: ACTION_STROKE_WIDTH, strokeLinecap: "round", strokeLinejoin: "round" }) as const;

export function ReplyActionIcon(props: IconProps) {
  return <StrokeGlyph {...props}>{(ink) => <Path d={REPLY_BUBBLE} {...stroked(ink)} />}</StrokeGlyph>;
}

export function RepostActionIcon(props: IconProps) {
  return (
    <StrokeGlyph {...props}>
      {(ink) => (
        <>
          <Path d="M4.5 11V9.2a3 3 0 0 1 3-3h11.3M15.6 3l3.2 3.2-3.2 3.2" {...stroked(ink)} />
          <Path d="M19.5 13v1.8a3 3 0 0 1-3 3H5.2M8.4 21l-3.2-3.2 3.2-3.2" {...stroked(ink)} />
        </>
      )}
    </StrokeGlyph>
  );
}

export function LikeActionIcon({ filled = false, ...props }: IconProps & { readonly filled?: boolean }) {
  return <StrokeGlyph {...props}>{(ink) => <Path d={HEART} fill={filled ? ink : "none"} {...stroked(ink)} />}</StrokeGlyph>;
}

export function ViewsActionIcon(props: IconProps) {
  return <StrokeGlyph {...props}>{(ink) => <Path d="M4.5 19.5v-5M9.5 19.5V9M14.5 19.5V12M19.5 19.5V4.5" {...stroked(ink)} />}</StrokeGlyph>;
}

export function BookmarkActionIcon({ filled = false, ...props }: IconProps & { readonly filled?: boolean }) {
  return <StrokeGlyph {...props}>{(ink) => <Path d={RIBBON} fill={filled ? ink : "none"} {...stroked(ink)} />}</StrokeGlyph>;
}

export function ShareActionIcon(props: IconProps) {
  return (
    <StrokeGlyph {...props}>
      {(ink) => <Path d="M12 14.5V3.8M7.9 7.7 12 3.6l4.1 4.1M4.5 13.5v4.6a2.4 2.4 0 0 0 2.4 2.4h10.2a2.4 2.4 0 0 0 2.4-2.4v-4.6" {...stroked(ink)} />}
    </StrokeGlyph>
  );
}

export function SendActionIcon(props: IconProps) {
  return (
    <StrokeGlyph {...props}>
      {(ink) => <Path d="M20.6 3.6 10.3 13.9M20.6 3.6 14.4 20.1a.5.5 0 0 1-.92.04l-3.18-6.24-6.24-3.18a.5.5 0 0 1 .04-.92Z" {...stroked(ink)} />}
    </StrokeGlyph>
  );
}

export function GiftActionIcon(props: IconProps) {
  return (
    <StrokeGlyph {...props}>
      {(ink) => (
        <>
          <Path d="M4.8 9.2h14.4a.8.8 0 0 1 .8.8v2.6a.8.8 0 0 1-.8.8H4.8a.8.8 0 0 1-.8-.8V10a.8.8 0 0 1 .8-.8ZM5.5 13.4v5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-5M12 9.2v11.2" {...stroked(ink)} />
          <Path d="M12 9.2C10.7 5.9 7 5 7 7.3c0 1.3 1.8 1.9 5 1.9ZM12 9.2c1.3-3.3 5-4.2 5-1.9 0 1.3-1.8 1.9-5 1.9Z" {...stroked(ink)} />
        </>
      )}
    </StrokeGlyph>
  );
}

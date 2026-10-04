import Svg, { Circle, Rect } from "react-native-svg";

import { useTheme } from "@/theme";

const PIECES = [
  { x: 14, y: 20, r: 4, shape: "circle", tone: 0 }, { x: 60, y: 10, r: 3, shape: "rect", tone: 1 }, { x: 108, y: 26, r: 4, shape: "circle", tone: 2 },
  { x: 160, y: 12, r: 3, shape: "rect", tone: 3 }, { x: 206, y: 30, r: 4, shape: "circle", tone: 1 }, { x: 250, y: 14, r: 3, shape: "rect", tone: 0 },
  { x: 36, y: 56, r: 3, shape: "rect", tone: 2 }, { x: 88, y: 62, r: 4, shape: "circle", tone: 3 }, { x: 140, y: 52, r: 3, shape: "rect", tone: 0 },
  { x: 188, y: 66, r: 4, shape: "circle", tone: 2 }, { x: 236, y: 58, r: 3, shape: "rect", tone: 1 }, { x: 282, y: 40, r: 4, shape: "circle", tone: 3 },
] as const;

export function CelebrationConfetti({ height = 80 }: { readonly height?: number }) {
  const { colors } = useTheme();
  const tones = [colors.primary, colors.success, colors.caution, colors.error];
  return (
    <Svg width="100%" height={height} viewBox="0 0 300 80" preserveAspectRatio="xMidYMid slice" accessible={false} pointerEvents="none">
      {PIECES.map((piece) =>
        piece.shape === "circle" ? (
          <Circle key={`${piece.x}-${piece.y}`} cx={piece.x} cy={piece.y} r={piece.r} fill={tones[piece.tone]} />
        ) : (
          <Rect key={`${piece.x}-${piece.y}`} x={piece.x} y={piece.y} width={piece.r * 2} height={piece.r * 1.2} rx={1} fill={tones[piece.tone]} transform={`rotate(${piece.x % 60} ${piece.x} ${piece.y})`} />
        ),
      )}
    </Svg>
  );
}

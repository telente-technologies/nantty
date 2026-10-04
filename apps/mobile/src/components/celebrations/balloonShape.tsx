import Svg, { Ellipse, Path } from "react-native-svg";

export interface BalloonShapeProps {
  readonly color: string;
  readonly size: number;
}

export function BalloonShape({ color, size }: BalloonShapeProps) {
  return (
    <Svg width={size} height={size * 1.5} viewBox="0 0 40 60" accessible={false}>
      <Ellipse cx="20" cy="19" rx="16" ry="19" fill={color} />
      <Ellipse cx="13" cy="11" rx="4" ry="6" fill="#FFFFFF" opacity={0.28} />
      <Path d="M20 38 L16.5 43 H23.5 Z" fill={color} />
      <Path d="M20 43 C16 49 24 53 20 59" stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity={0.8} />
    </Svg>
  );
}

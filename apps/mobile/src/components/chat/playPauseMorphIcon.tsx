import { interpolatePlayPausePolygons, polygonPathData } from "@zudomart/chat-crypto";
import Svg, { Path } from "react-native-svg";

import { usePlayPauseMorphProgress } from "./playPauseMorph.hook";

export function PlayPauseMorphIcon({ isPlaying, color, size = 20, reduceMotion }: { readonly isPlaying: boolean; readonly color: string; readonly size?: number; readonly reduceMotion: boolean }) {
  const [firstShape, secondShape] = interpolatePlayPausePolygons(usePlayPauseMorphProgress(isPlaying, reduceMotion));
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={polygonPathData(firstShape)} fill={color} strokeLinejoin="round" />
      <Path d={polygonPathData(secondShape)} fill={color} strokeLinejoin="round" />
    </Svg>
  );
}

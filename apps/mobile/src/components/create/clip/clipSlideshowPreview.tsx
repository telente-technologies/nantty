import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft, useReducedMotion } from "react-native-reanimated";

import type { ClipTransition } from "@/types";

const TRANSITION_MS = 300;

export interface ClipSlideshowPreviewProps {
  readonly uris: readonly string[];
  readonly secondsPerImage: readonly number[];
  readonly transition: ClipTransition;
  readonly isPlaying: boolean;
}

const animationsFor = (transition: ClipTransition, reduceMotion: boolean) => {
  if (reduceMotion || transition === "none") return { entering: undefined, exiting: undefined };
  if (transition === "slide") return { entering: SlideInRight.duration(TRANSITION_MS), exiting: SlideOutLeft.duration(TRANSITION_MS) };
  return { entering: FadeIn.duration(TRANSITION_MS), exiting: FadeOut.duration(TRANSITION_MS) };
};

export function ClipSlideshowPreview({ uris, secondsPerImage, transition, isPlaying }: ClipSlideshowPreviewProps) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const safeIndex = uris.length > 0 ? index % uris.length : 0;
  useEffect(() => {
    if (!isPlaying || uris.length < 2) return;
    const timer = setTimeout(() => setIndex((current) => (current + 1) % uris.length), (secondsPerImage[safeIndex] ?? 3) * 1000);
    return () => clearTimeout(timer);
  }, [isPlaying, safeIndex, secondsPerImage, uris.length]);
  const uri = uris[safeIndex];
  if (!uri) return null;
  const { entering, exiting } = animationsFor(transition, reduceMotion);
  return (
    <View style={styles.root} accessibilityLabel={`Photo ${safeIndex + 1} of ${uris.length}`}>
      <Animated.View key={`${safeIndex}_${uri}`} entering={entering} exiting={exiting} style={StyleSheet.absoluteFill}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, overflow: "hidden" } });

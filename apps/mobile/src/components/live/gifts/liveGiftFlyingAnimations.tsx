import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";

import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";

import { LiveGiftArtwork } from "./liveGiftArtwork";
import type { LiveGiftAnimationEntry } from "./liveGiftOverlayQueues.hook";
import { LiveGiftParticleBurst } from "./liveGiftParticles";

const SIZE_MULTIPLIER_BY_ESCALATION_STAGE = [1, 1.25, 1.5, 1.8, 2.1] as const;
const sizeMultiplierFor = (stage: number) => SIZE_MULTIPLIER_BY_ESCALATION_STAGE[Math.min(stage, 4)] ?? 1;

function LiveGiftMicroFloat({ entry, onDone }: { entry: LiveGiftAnimationEntry; onDone: (key: string) => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const sway = useRef((entry.event.comboCount % 5) * 9 - 18).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: entry.durationMs + 600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => onDone(entry.key));
  }, [entry.durationMs, entry.key, onDone, progress]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -240] });
  const translateX = progress.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: [0, sway, -sway / 2, sway] });
  const scale = progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.3, 1.15, 0.85] });
  const opacity = progress.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] });
  return (
    <Animated.View style={[styles.microFloat, { opacity, transform: [{ translateX }, { translateY }, { scale }] }]}>
      <LiveGiftArtwork assetKey={entry.event.animationAssetKey} size={36 * sizeMultiplierFor(entry.escalationStage)} />
    </Animated.View>
  );
}

function LiveGiftMediumFlyer({ entry, onDone }: { entry: LiveGiftAnimationEntry; onDone: (key: string) => void }) {
  const { width, height } = useWindowDimensions();
  const flight = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const artworkSize = Math.min(width * 0.3, 120) * sizeMultiplierFor(entry.escalationStage) * 0.8;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(flight, { toValue: 1, duration: entry.durationMs * 0.6, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(burst, { toValue: 1, duration: entry.durationMs * 0.4, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => onDone(entry.key));
  }, [burst, entry.durationMs, entry.key, flight, onDone]);
  const translateX = flight.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.55, 0] });
  const translateY = flight.interpolate({ inputRange: [0, 0.5, 1], outputRange: [height * 0.22, -height * 0.02, -height * 0.12] });
  const rotate = flight.interpolate({ inputRange: [0, 1], outputRange: ["-35deg", "0deg"] });
  const scale = Animated.add(flight.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }), burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.25, 0.1] }));
  const opacity = burst.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
  return (
    <Animated.View style={[styles.mediumFlyer, { opacity, transform: [{ translateX }, { translateY }] }]}>
      <LiveGiftParticleBurst progress={burst} assetKey={entry.event.animationAssetKey} count={10 + entry.escalationStage * 4} distance={artworkSize} />
      <Animated.View style={{ transform: [{ rotate }, { scale }] }}>
        <LiveGiftArtwork assetKey={entry.event.animationAssetKey} size={artworkSize} />
      </Animated.View>
    </Animated.View>
  );
}

export function LiveGiftFlyingAnimations(props: {
  microFloats: readonly LiveGiftAnimationEntry[];
  mediumFlyers: readonly LiveGiftAnimationEntry[];
  onMicroFloatDone: (key: string) => void;
  onMediumFlyerDone: (key: string) => void;
}) {
  const reducedMotion = useReducedMotionPreference();
  useEffect(() => {
    if (!reducedMotion) return;
    props.mediumFlyers.forEach((entry) => props.onMediumFlyerDone(entry.key));
    props.microFloats.forEach((entry) => props.onMicroFloatDone(entry.key));
  }, [reducedMotion, props]);
  if (reducedMotion) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {props.mediumFlyers.map((entry) => (
        <LiveGiftMediumFlyer key={entry.key} entry={entry} onDone={props.onMediumFlyerDone} />
      ))}
      {props.microFloats.map((entry) => (
        <LiveGiftMicroFloat key={entry.key} entry={entry} onDone={props.onMicroFloatDone} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  microFloat: { position: "absolute", right: 28, bottom: 200 },
  mediumFlyer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
});

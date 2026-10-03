import { Animated, StyleSheet } from "react-native";
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from "react-native-svg";

import { LiveGiftParticleGlyph } from "./liveGiftArtwork";

export function LiveGiftParticleBurst({ progress, assetKey, count, distance }: { progress: Animated.Value; assetKey: string; count: number; distance: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * Math.PI * 2;
        const reach = distance * (0.65 + ((index * 37) % 10) / 25);
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * reach] });
        const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * reach + reach * 0.25] });
        const opacity = progress.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 1, 1, 0] });
        const scale = progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.2, 1.1, 0.5] });
        return (
          <Animated.View key={index} style={[styles.particle, { opacity, transform: [{ translateX }, { translateY }, { scale }] }]}>
            <LiveGiftParticleGlyph assetKey={assetKey} size={index % 3 === 0 ? 22 : 14} color={index % 2 === 0 ? undefined : "#FFFFFF"} />
          </Animated.View>
        );
      })}
    </>
  );
}

export function LiveGiftOrbitRing({ width, color }: { width: number; color: string }) {
  return (
    <Svg width={width} height={width * 0.4} viewBox="0 0 200 80">
      <Ellipse cx={100} cy={40} rx={94} ry={30} fill="none" stroke={color} strokeWidth={3} strokeDasharray="140 30 60 30" strokeLinecap="round" />
      <Ellipse cx={100} cy={40} rx={80} ry={22} fill="none" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={1.5} />
    </Svg>
  );
}

export function LiveGiftLightRays({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <RadialGradient id="giftRayGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.85} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {Array.from({ length: 12 }, (_, index) => (
        <Path key={index} d="M100 100 L92 0 L108 0 Z" fill="url(#giftRayGlow)" transform={`rotate(${index * 30} 100 100)`} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({ particle: { position: "absolute" } });

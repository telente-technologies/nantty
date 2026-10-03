import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";

import { findLiveGiftArtworkPreset, type LiveGiftArtworkPreset } from "./liveGiftArtworkPresets.constant";
import { LIVE_GIFT_GLYPH_PATHS, STROKED_LIVE_GIFT_GLYPHS } from "./liveGiftGlyphs.constant";

export interface LiveGiftArtworkProps {
  readonly assetKey: string | null | undefined;
  readonly size: number;
}

function RoseArtwork() {
  return (
    <>
      <Defs>
        <RadialGradient id="rosePetal" cx="50%" cy="40%" r="60%">
          <Stop offset="0" stopColor="#FF6B81" />
          <Stop offset="1" stopColor="#B3001B" />
        </RadialGradient>
      </Defs>
      <Path d="M50 52 C48 70 52 82 50 98" stroke="#2E8B3A" strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path d="M50 76 C38 70 30 72 26 80 C36 84 44 82 50 76 Z" fill="#3FAE4C" />
      <Path d="M51 68 C62 60 72 62 76 70 C66 75 58 74 51 68 Z" fill="#3FAE4C" />
      <Path d="M50 8 C70 10 82 24 80 40 C78 56 64 62 50 62 C36 62 22 56 20 40 C18 24 30 10 50 8 Z" fill="url(#rosePetal)" />
      <Path d="M50 18 C62 20 68 30 64 40 C60 48 52 50 46 46 C40 42 40 32 50 30" stroke="#8C0015" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d="M28 34 C34 46 44 52 56 52" stroke="#D4213D" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </>
  );
}

function GalaxyArtwork() {
  return (
    <>
      <Defs>
        <RadialGradient id="galaxyCore" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.25" stopColor="#B69CFF" />
          <Stop offset="0.7" stopColor="#4B1FA8" stopOpacity={0.8} />
          <Stop offset="1" stopColor="#120638" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={50} cy={50} r={48} fill="url(#galaxyCore)" />
      <Ellipse cx={50} cy={50} rx={44} ry={12} fill="none" stroke="#FFD27A" strokeWidth={2.5} transform="rotate(-20 50 50)" />
      <Circle cx={50} cy={50} r={14} fill="#7C4DFF" />
      <Circle cx={45} cy={45} r={5} fill="#FFFFFF" opacity={0.6} />
    </>
  );
}

function GlyphArtwork({ preset, gradientId }: { preset: LiveGiftArtworkPreset; gradientId: string }) {
  const path = LIVE_GIFT_GLYPH_PATHS[preset.glyph];
  const isStroked = STROKED_LIVE_GIFT_GLYPHS.has(preset.glyph);
  return (
    <>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={preset.gradient[0]} />
          <Stop offset="1" stopColor={preset.gradient[1]} />
        </LinearGradient>
      </Defs>
      {isStroked ? (
        <Path d={path} stroke={`url(#${gradientId})`} strokeWidth={7} strokeLinecap="round" fill="none" />
      ) : (
        <>
          <Path d={path} fill={`url(#${gradientId})`} fillRule="evenodd" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={2} strokeLinejoin="round" />
          <Ellipse cx={36} cy={28} rx={12} ry={6} fill="#FFFFFF" opacity={0.3} transform="rotate(-25 36 28)" />
        </>
      )}
    </>
  );
}

export function LiveGiftArtwork({ assetKey, size }: LiveGiftArtworkProps) {
  const preset = findLiveGiftArtworkPreset(assetKey);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {preset.bespoke === "rose" ? <RoseArtwork /> : null}
      {preset.bespoke === "galaxy" ? <GalaxyArtwork /> : null}
      {preset.bespoke ? null : <GlyphArtwork preset={preset} gradientId={`giftFill_${assetKey ?? "fallback"}`} />}
    </Svg>
  );
}

export function LiveGiftParticleGlyph({ assetKey, size, color }: { assetKey: string | null | undefined; size: number; color?: string }) {
  const preset = findLiveGiftArtworkPreset(assetKey);
  const isStroked = STROKED_LIVE_GIFT_GLYPHS.has(preset.particleGlyph);
  const fill = color ?? preset.accent;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d={LIVE_GIFT_GLYPH_PATHS[preset.particleGlyph]}
        fill={isStroked ? "none" : fill}
        stroke={isStroked ? fill : undefined}
        strokeWidth={isStroked ? 8 : 0}
        fillRule="evenodd"
      />
    </Svg>
  );
}

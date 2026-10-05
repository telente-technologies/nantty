import { ArrowLeftIcon, ChatsCircleIcon, DotsThreeVerticalIcon, MagnifyingGlassIcon, PlusIcon, ShoppingBagOpenIcon, SignOutIcon } from "./phosphorGlyphs";
import { phosphorBadgeIcon } from "./phosphorIcon";

const ROUNDED_TILE = { box: 32, radius: 8, fill: "#D9D9D9", glyph: 20, glyphInk: "#000000" } as const;

export const Frame30132Icon = phosphorBadgeIcon(PlusIcon, { box: 32, radius: 16, fill: "#3A2BFF", glyph: 18, glyphInk: "#FFFFFF" });
export const Frame75132Icon = phosphorBadgeIcon(DotsThreeVerticalIcon, ROUNDED_TILE);
export const Frame75232Icon = phosphorBadgeIcon(MagnifyingGlassIcon, ROUNDED_TILE);
export const Frame75332Icon = phosphorBadgeIcon(ArrowLeftIcon, ROUNDED_TILE);
export const Frame83032Icon = phosphorBadgeIcon(SignOutIcon, { ...ROUNDED_TILE, fill: "#FDECEC", glyphInk: "#EF4444" });
export const WechatLogo48Icon = phosphorBadgeIcon(ChatsCircleIcon, { box: 48, radius: 14, fill: "#2043F5", glyph: 24, glyphInk: "#FFFFFF", weight: "fill" });
export const ViewProducts24Icon = phosphorBadgeIcon(ShoppingBagOpenIcon, {
  box: 24,
  radius: 12,
  fill: "#FFFFFF",
  fillOpacity: 0.25,
  glyph: 14,
  glyphInk: "#FFFFFF",
  tintGlyph: true,
});

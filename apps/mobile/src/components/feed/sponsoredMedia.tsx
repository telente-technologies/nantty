import { useNavigation } from "@react-navigation/native";
import type { ReactNode } from "react";
import { Pressable } from "react-native";

import { SponsoredCarousel } from "@/components/feed/sponsoredCarousel";
import { openSponsoredTarget } from "@/services/adClick.service";
import type { AdPlacement, ID, SponsoredPlacement } from "@/types";

interface SponsoredMediaProps {
  readonly sponsored: SponsoredPlacement | null | undefined;
  readonly placement: AdPlacement;
  readonly itemId: ID;
  readonly children: ReactNode;
}

const isMediaTappable = (sponsored: SponsoredPlacement) => Boolean(sponsored.mediaClickable) || sponsored.adType === "promoted_post" || sponsored.adType === "app_install";

/** Wraps the media of an ad post: swaps in the carousel, or makes the media itself open the destination. Organic posts pass straight through. */
export function SponsoredMedia({ sponsored, placement, itemId, children }: SponsoredMediaProps) {
  const navigation = useNavigation();
  if (!sponsored) return <>{children}</>;
  if (sponsored.adType === "carousel" && (sponsored.cards?.length ?? 0) > 0) return <SponsoredCarousel sponsored={sponsored} placement={placement} itemId={itemId} />;
  if (!isMediaTappable(sponsored)) return <>{children}</>;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={sponsored.adType === "promoted_post" ? "Open the promoted post" : `Open ${sponsored.advertiserName} link`}
      onPress={() => openSponsoredTarget({ sponsored, placement, itemId, target: { kind: "media" }, navigation })}
    >
      {children}
    </Pressable>
  );
}

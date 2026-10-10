import * as WebBrowser from "expo-web-browser";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { Linking, Platform } from "react-native";

import { adEventsService } from "@/services/ads/adEvents.service";
import type { AdPlacement, AdPlatform, AdTapTarget, ID, SponsoredPlacement } from "@/types";
import { resolveAdTapAction } from "@/utils/adDestination.util";

export type AdNavigation = Pick<NavigationProp<ParamListBase>, "navigate">;

export const currentAdPlatform = (): AdPlatform => (Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web");

function isSignedRedirect(sponsored: SponsoredPlacement, url: string): boolean {
  const links = sponsored.clickLinks;
  return Boolean(links && (links.cta === url || links.media === url || links.cards?.includes(url)));
}

export async function openSponsoredTarget(input: {
  readonly sponsored: SponsoredPlacement;
  readonly placement: AdPlacement;
  readonly itemId: ID;
  readonly target: AdTapTarget;
  readonly navigation: AdNavigation;
}): Promise<void> {
  const { sponsored, placement, itemId, target, navigation } = input;
  const cardIndex = target.kind === "card" ? target.index : undefined;
  const action = resolveAdTapAction(sponsored, target, currentAdPlatform());
  const recordClick = () => adEventsService.recordSponsoredClick(sponsored, placement, itemId, cardIndex);
  if (action.kind === "internal") {
    recordClick();
    navigation.navigate(action.route, action.params);
    return;
  }
  if (action.kind === "external") {
    if (!isSignedRedirect(sponsored, action.url)) recordClick();
    await WebBrowser.openBrowserAsync(action.url).catch(() => undefined);
    return;
  }
  if (action.kind === "install") {
    if (action.deepLink && (await Linking.canOpenURL(action.deepLink).catch(() => false))) {
      recordClick();
      await Linking.openURL(action.deepLink).catch(() => undefined);
      return;
    }
    if (!isSignedRedirect(sponsored, action.url)) recordClick();
    await Linking.openURL(action.url).catch(() => undefined);
    return;
  }
  recordClick();
}

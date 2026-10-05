import * as WebBrowser from "expo-web-browser";

import { assessLinkRisk, buildInternalRoute, isWebUrl, readFullDomain, readInternalReferenceFromUrl } from "@/components/chat/chatLinks.util";
import { rootNavigationRef } from "@/navigation/navigationRef";
import { showDialog } from "@/store/dialog.store";
import type { ThemeColors } from "@/theme/themeColors.constant";

export interface InAppBrowserColors {
  readonly toolbar: string;
  readonly controls: string;
}

export const inAppBrowserColorsFromTheme = (colors: ThemeColors): InAppBrowserColors => ({ toolbar: colors.surface, controls: colors.link });

export async function openInAppBrowser(url: string, colors?: InAppBrowserColors) {
  if (!isWebUrl(url)) return;
  await WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    toolbarColor: colors?.toolbar,
    secondaryToolbarColor: colors?.toolbar,
    controlsColor: colors?.controls,
    showTitle: true,
    enableBarCollapsing: true,
    enableDefaultShareMenuItem: true,
    showInRecents: false,
    dismissButtonStyle: "close",
    readerMode: false,
  }).catch(() => undefined);
}

const navigateToInternalUrl = (url: string): boolean => {
  const reference = readInternalReferenceFromUrl(url);
  if (!reference || !rootNavigationRef.isReady()) return false;
  const route = buildInternalRoute(reference);
  (rootNavigationRef.navigate as (name: string, params: object) => void)(route.name, route.params);
  return true;
};

export function confirmRiskyLink(url: string, onOpen: () => void) {
  const risk = assessLinkRisk(url);
  if (risk === "safe") {
    onOpen();
    return;
  }
  const domain = readFullDomain(url);
  showDialog({
    title: risk === "shortened" ? "Shortened link" : "Suspicious link",
    message:
      risk === "shortened"
        ? `This link hides its real destination (${domain}). Only open it if you trust the person who shared it.`
        : `${domain} looks unusual and may be unsafe. Do not enter passwords or payment details.`,
    tone: "caution",
    actions: [
      { label: "Open anyway", style: "destructive", onPress: onOpen },
      { label: "Cancel", style: "secondary" },
    ],
  });
}

export function openLinkFromText(href: string, colors?: InAppBrowserColors) {
  if (navigateToInternalUrl(href)) return;
  confirmRiskyLink(href, () => void openInAppBrowser(href, colors));
}

export const openTrustedWebPage = (url: string, colors?: InAppBrowserColors) => void openInAppBrowser(url, colors);

export const openUserSuppliedWebLink = (url: string, colors?: InAppBrowserColors) => confirmRiskyLink(url, () => void openInAppBrowser(url, colors));

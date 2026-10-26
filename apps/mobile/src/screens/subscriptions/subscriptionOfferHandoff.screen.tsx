import { useCallback, useEffect, useRef } from "react";

import { inAppBrowserColorsFromTheme, openInAppBrowser } from "@/components/links/openLink.util";
import { EmptyState } from "@/components/ui/emptyState";
import { Screen } from "@/components/ui/screen";
import { webAppLinks } from "@/config/webAppLinks.config";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { useTheme } from "@/theme";

export function SubscriptionOfferHandoffScreen({ route, navigation }: MainScreenProps<"SubscriptionOffer">) {
  const { colors } = useTheme();
  const hasOpened = useRef(false);
  const openOfferOnTheWeb = useCallback(async () => {
    await openInAppBrowser(webAppLinks.subscriptionOffer(route.params.token), inAppBrowserColorsFromTheme(colors));
    if (navigation.canGoBack()) navigation.goBack();
  }, [colors, navigation, route.params.token]);
  useEffect(() => {
    if (hasOpened.current) return;
    hasOpened.current = true;
    void openOfferOnTheWeb();
  }, [openOfferOnTheWeb]);
  return (
    <Screen>
      <EmptyState
        title="Claim your offer on the web"
        body="Plan discounts are paid on the Nantty website because app store purchases can't take them. Sign in there with this account and your plan shows up here too."
        actionLabel="Open the offer"
        onAction={() => void openOfferOnTheWeb()}
      />
    </Screen>
  );
}

import * as WebBrowser from "expo-web-browser";

import { sellerWebAppConfig } from "@/config/sellerWebApp.config";
import { webAppLinks } from "@/config/webAppLinks.config";

export const webHandoffService = {
  openManageBilling: (profileId: string) => WebBrowser.openBrowserAsync(`${sellerWebAppConfig.dashboardUrl}/billing?profile=${encodeURIComponent(profileId)}`),
  openGovernmentApplication: () => WebBrowser.openBrowserAsync(`${sellerWebAppConfig.dashboardUrl}/verification/government`),
  openGoldForBusinessesCheckout: (input: Parameters<typeof webAppLinks.goldForBusinessesCheckout>[0]) => WebBrowser.openBrowserAsync(webAppLinks.goldForBusinessesCheckout(input)),
};

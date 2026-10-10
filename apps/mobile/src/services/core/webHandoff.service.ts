import * as WebBrowser from "expo-web-browser";

import { sellerWebAppConfig } from "@/config/sellerWebApp.config";

export const webHandoffService = {
  openManageBilling: (profileId: string) => WebBrowser.openBrowserAsync(`${sellerWebAppConfig.dashboardUrl}/billing?profile=${encodeURIComponent(profileId)}`),
  openGovernmentApplication: () => WebBrowser.openBrowserAsync(`${sellerWebAppConfig.dashboardUrl}/verification/government`),
};

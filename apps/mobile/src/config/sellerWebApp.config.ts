declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly EXPO_PUBLIC_SELLER_WEB_URL?: string;
    }
  }
}

const DEVELOPMENT_SELLER_DASHBOARD_URL = "http://localhost:3200";
const PRODUCTION_SELLER_DASHBOARD_URL = "https://creator.nantty.com";

export const sellerWebAppConfig = {
  dashboardUrl: process.env.EXPO_PUBLIC_SELLER_WEB_URL || (__DEV__ ? DEVELOPMENT_SELLER_DASHBOARD_URL : PRODUCTION_SELLER_DASHBOARD_URL),
};

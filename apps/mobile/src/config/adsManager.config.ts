declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly EXPO_PUBLIC_ADS_MANAGER_URL?: string;
    }
  }
}

export const adsManagerConfig = {
  adsManagerUrl: process.env.EXPO_PUBLIC_ADS_MANAGER_URL || (__DEV__ ? "http://localhost:3300" : "https://ads.nantty.com"),
};

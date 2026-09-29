import { Platform } from "react-native";

export const socialSignInConfig = {
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
};

export const findGoogleClientIdForThisPlatform = (): string | null => {
  const clientId = Platform.select({
    ios: socialSignInConfig.googleIosClientId,
    android: socialSignInConfig.googleAndroidClientId,
    default: socialSignInConfig.googleWebClientId,
  });
  return clientId.trim() ? clientId.trim() : null;
};

import { StatusBar } from "expo-status-bar";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from "@expo-google-fonts/inter";
import { useState } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useMessengerAuth } from "./auth/AuthProvider";
import { MessengerAppShell } from "./navigation/MessengerAppShell";
import { SignInScreen } from "./screens/SignInScreen";
import { ForgotPasswordScreen } from "./screens/ForgotPasswordScreen";
import { DeviceAuthorizationScreen } from "./screens/DeviceAuthorizationScreen";
import { SessionRestoreScreen } from "./screens/SessionRestoreScreen";
import { messengerTheme } from "./theme";
import { BrandLockup } from "./ui/BrandLockup";
import { MessengerNotificationController } from "./notifications/MessengerNotificationController";

export function MessengerRoot() {
  const systemScheme = useColorScheme();
  const { status } = useMessengerAuth();
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const colors = systemScheme === "dark" ? messengerTheme.dark : messengerTheme.light;

  return (
    <>
      <SafeAreaProvider>
        <StatusBar style={systemScheme === "dark" ? "light" : "dark"} />
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {!fontsLoaded ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 18 }}>
              <BrandLockup />
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : null}
          {fontsLoaded && status === "restoring" ? <SessionRestoreScreen /> : null}
          {fontsLoaded && status === "restoreFailed" ? <SessionRestoreScreen failed /> : null}
          {fontsLoaded && status === "signedOut" && !recoveryVisible ? <SignInScreen onForgotPassword={() => setRecoveryVisible(true)} /> : null}
          {fontsLoaded && status === "signedOut" && recoveryVisible ? <ForgotPasswordScreen onBack={() => setRecoveryVisible(false)} /> : null}
          {fontsLoaded && (status === "authorizationRequired" || status === "authorizationDenied" || status === "authorizationExpired") ? <DeviceAuthorizationScreen /> : null}
          {fontsLoaded && status === "signedIn" ? <MessengerAppShell /> : null}
        </View>
      </SafeAreaProvider>
      <MessengerNotificationController />
    </>
  );
}

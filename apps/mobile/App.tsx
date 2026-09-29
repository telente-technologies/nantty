import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DeviceFrame } from "@/components/ui/deviceFrame";
import { RootNavigator } from "@/navigation/root.navigator";
import { localeService } from "@/services/locale.service";
import { useAuthStore } from "@/store/auth.store";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  });

  const authStatus = useAuthStore((s) => s.status);
  const ready = (fontsLoaded || !!fontError) && authStatus !== "loading";

  useEffect(() => {
    useAuthStore.getState().restoreSavedSession().catch(() => useAuthStore.setState({ status: "signedOut" }));
  }, []);

  useEffect(() => {
    if (authStatus === "loading") return;
    localeService
      .loadViewerLocaleIntoStore()
      .then(() => queryClient.invalidateQueries())
      .catch(() => undefined);
  }, [authStatus, queryClient]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <DeviceFrame>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <RootNavigator />
        </QueryClientProvider>
      </DeviceFrame>
    </SafeAreaProvider>
  );
}

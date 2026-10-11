import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
  useFonts,
} from "@expo-google-fonts/inter";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { deleteAllLocallySavedMessageHistory } from "@/cache/messageSync.util";
import { OfflineIndicator } from "@/cache/offlineIndicator";
import {
  connectReactQueryToNetworkAndAppState,
  createZudomartQueryClient,
  reactQueryAsyncStoragePersister,
  reactQueryPersistOptions,
} from "@/cache/queryClient.config";
import { invalidateQueriesAffectedByReplayedOfflineMutation } from "@/cache/offlineReplayInvalidation.util";
import { BootSplash } from "@/components/brand/bootSplash";
import { KeepRealtimeMessagingConnectedWhileSignedIn } from "@/components/chat/appWideRealtimeConnection";
import { DeviceFrame } from "@/components/ui/deviceFrame";
import { ErrorBoundary } from "@/components/ui/errorBoundary";
import { CelebrationHost } from "@/components/celebrations/celebrationHost";
import { RootNavigator } from "@/navigation/root.navigator";
import { localeService } from "@/services/geo/locale.service";
import { cancelAndRemoveUpload } from "@/services/media/mediaUploadQueue.service";
import { startAutomaticUploadResume } from "@/services/core/uploadBackgroundTask.service";
import { startHomeScreenWidgetSync, syncHomeScreenWidgetsNow } from "@/services/widgets/widgetSync.service";
import { forgetDecryptedAttachmentsInMemory } from "@/services/chatCrypto/encryptedAttachments.service";
import { startDecryptedMediaHygiene, wipeDecryptedFiles } from "@/services/chatCrypto/ephemeralDecryptedFiles.service";
import { useAuthStore } from "@/store/auth.store";
import { addOfflineMutationReplayedListener, startOfflineConnectivityMonitoring, useOfflineStore } from "@/store/offline.store";
import { useUploadQueueStore } from "@/store/uploadQueue.store";
import { ThemeProvider, useTheme } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);
WebBrowser.maybeCompleteAuthSession();

const hideNativeSplash = () => {
  SplashScreen.hideAsync().catch(() => undefined);
};

export default function App() {
  const [queryClient] = useState(createZudomartQueryClient);
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
    startDecryptedMediaHygiene();
    useAuthStore.getState().restoreSavedSession().catch(() => useAuthStore.setState({ status: "signedOut" }));
  }, []);

  useEffect(() => {
    const stopReactQueryNetworkListeners = connectReactQueryToNetworkAndAppState();
    const stopOfflineConnectivityMonitoring = startOfflineConnectivityMonitoring();
    const stopListeningForReplayedMutations = addOfflineMutationReplayedListener((mutation) =>
      invalidateQueriesAffectedByReplayedOfflineMutation(queryClient, mutation),
    );
    return () => {
      stopReactQueryNetworkListeners();
      stopOfflineConnectivityMonitoring();
      stopListeningForReplayedMutations();
    };
  }, [queryClient]);

  useEffect(() => {
    if (authStatus !== "signedIn") return;
    startAutomaticUploadResume();
    startHomeScreenWidgetSync();
    syncHomeScreenWidgetsNow({ force: true }).catch(() => undefined);
  }, [authStatus]);

  useEffect(() => {
    if (authStatus !== "signedOut") return;
    Object.keys(useUploadQueueStore.getState().jobsById).forEach(cancelAndRemoveUpload);
    queryClient.clear();
    Promise.resolve(reactQueryAsyncStoragePersister.removeClient()).catch(() => undefined);
    deleteAllLocallySavedMessageHistory();
    forgetDecryptedAttachmentsInMemory();
    wipeDecryptedFiles();
    useOfflineStore.getState().clearQueuedMutations();
  }, [authStatus, queryClient]);

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

  if (!ready) {
    return (
      <ThemeProvider>
        <BootSplash onLayout={hideNativeSplash} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <ErrorBoundary>
        <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
        <DeviceFrame>
          <PersistQueryClientProvider client={queryClient} persistOptions={reactQueryPersistOptions}>
            <StatusBarFollowingTheme />
            <KeepRealtimeMessagingConnectedWhileSignedIn />
            <RootNavigator />
            <CelebrationHost />
            <OfflineIndicator />
          </PersistQueryClientProvider>
        </DeviceFrame>
        </KeyboardProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function StatusBarFollowingTheme() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

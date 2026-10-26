import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { MutationCache, QueryCache, QueryClient, focusManager, onlineManager, type Query } from "@tanstack/react-query";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";

import { handleGlobalApiError, shouldRetryQuery } from "@/errors/errorExperience/globalErrorHandler";
import { isDeviceConnectedAccordingToNetInfo } from "@/store/offline.store";

const ONE_SECOND_MS = 1_000;
const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

export const PERSISTED_QUERY_CACHE_STORAGE_KEY = "zm.reactQueryCache";

export const staleTimeByQueryKeyPrefix: Readonly<Record<string, number>> = {
  feed: ONE_MINUTE_MS,
  "feed-suggested-clips": 5 * ONE_MINUTE_MS,
  clips: 2 * ONE_MINUTE_MS,
  post: ONE_MINUTE_MS,
  "post-comments": 30 * ONE_SECOND_MS,
  stories: ONE_MINUTE_MS,
  "story-tray": ONE_MINUTE_MS,
  products: 5 * ONE_MINUTE_MS,
  "mart-home": 5 * ONE_MINUTE_MS,
  stores: 5 * ONE_MINUTE_MS,
  users: 5 * ONE_MINUTE_MS,
  categories: ONE_HOUR_MS,
  topics: ONE_HOUR_MS,
  conversations: 15 * ONE_SECOND_MS,
  conversation: 5 * ONE_MINUTE_MS,
  messages: 0,
};

const decryptedChatQueryKeyPrefixes = new Set(["conversations", "conversation", "messages"]);
const persistableQueryKeyPrefixes = new Set(Object.keys(staleTimeByQueryKeyPrefix).filter((prefix) => !decryptedChatQueryKeyPrefixes.has(prefix)));

export const isQuerySafeToPersistOnDevice = (query: Query) =>
  query.state.status === "success" && typeof query.queryKey[0] === "string" && persistableQueryKeyPrefixes.has(query.queryKey[0]);

export function createNanttyQueryClient() {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error) => handleGlobalApiError(error) }),
    mutationCache: new MutationCache({ onError: (error) => handleGlobalApiError(error) }),
    defaultOptions: {
      queries: { staleTime: 30 * ONE_SECOND_MS, gcTime: ONE_DAY_MS, retry: shouldRetryQuery, networkMode: "offlineFirst" },
      mutations: { networkMode: "offlineFirst" },
    },
  });
  for (const [queryKeyPrefix, staleTime] of Object.entries(staleTimeByQueryKeyPrefix)) {
    queryClient.setQueryDefaults([queryKeyPrefix], {
      staleTime,
      gcTime: ONE_DAY_MS,
      ...(queryKeyPrefix === "messages" ? { refetchOnWindowFocus: "always" as const } : null),
    });
  }
  return queryClient;
}

export const reactQueryAsyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSISTED_QUERY_CACHE_STORAGE_KEY,
  throttleTime: ONE_SECOND_MS,
});

export const reactQueryPersistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister: reactQueryAsyncStoragePersister,
  maxAge: ONE_DAY_MS,
  buster: Constants.expoConfig?.version ?? "0",
  dehydrateOptions: { shouldDehydrateQuery: isQuerySafeToPersistOnDevice },
};

export function connectReactQueryToNetworkAndAppState() {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(isDeviceConnectedAccordingToNetInfo(state))),
  );
  if (Platform.OS === "web") return () => undefined;
  const appStateSubscription = AppState.addEventListener("change", (status) => focusManager.setFocused(status === "active"));
  return () => appStateSubscription.remove();
}

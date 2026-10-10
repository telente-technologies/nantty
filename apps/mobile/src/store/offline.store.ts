import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  addMutationToQueueCancellingOppositeToggles,
  type OfflineMutation,
  type QueuedOfflineMutation,
} from "@/cache/offlineMutation.type";
import { handleOfflineMutationPermanentlyDropped, sendQueuedOfflineMutationToServer } from "@/cache/offlineMutationExecutor.util";
import { generateIdempotencyKey, isNetworkFailureError, isRetryableApiFailure } from "@/services/core/apiClient.service";
import { sealedAsyncStorage } from "@/utils/localDataSealing.util";

const MAXIMUM_REPLAY_ATTEMPTS_BEFORE_DROPPING = 6;
const MAXIMUM_REPLAY_BACKOFF_MS = 60_000;

interface OfflineState {
  readonly isOnline: boolean;
  readonly queuedMutations: readonly QueuedOfflineMutation[];
  readonly isReplayingQueuedMutations: boolean;
  readonly setOnlineStatus: (isOnline: boolean) => void;
  readonly enqueueMutationForReplayWhenOnline: (mutation: OfflineMutation, idempotencyKey?: string) => void;
  readonly replayQueuedMutationsInOrder: () => Promise<void>;
  readonly clearQueuedMutations: () => void;
}

type OfflineMutationReplayedListener = (mutation: QueuedOfflineMutation) => void;

const offlineMutationReplayedListeners = new Set<OfflineMutationReplayedListener>();
let scheduledReplayRetryTimer: ReturnType<typeof setTimeout> | null = null;

export const addOfflineMutationReplayedListener = (listener: OfflineMutationReplayedListener) => {
  offlineMutationReplayedListeners.add(listener);
  return () => {
    offlineMutationReplayedListeners.delete(listener);
  };
};

const calculateReplayBackoffWithJitterMs = (attempts: number) =>
  Math.min(MAXIMUM_REPLAY_BACKOFF_MS, 1_000 * 2 ** attempts) + Math.floor(Math.random() * 500);

function scheduleReplayRetryAfterBackoff(attempts: number) {
  if (scheduledReplayRetryTimer) clearTimeout(scheduledReplayRetryTimer);
  scheduledReplayRetryTimer = setTimeout(() => {
    scheduledReplayRetryTimer = null;
    useOfflineStore.getState().replayQueuedMutationsInOrder().catch(() => undefined);
  }, calculateReplayBackoffWithJitterMs(attempts));
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      isOnline: true,
      queuedMutations: [],
      isReplayingQueuedMutations: false,
      setOnlineStatus: (isOnline) => {
        const wasOnline = get().isOnline;
        set({ isOnline });
        if (isOnline && !wasOnline) get().replayQueuedMutationsInOrder().catch(() => undefined);
      },
      enqueueMutationForReplayWhenOnline: (mutation, idempotencyKey) => {
        const queuedMutation = {
          ...mutation,
          id: `offline_${generateIdempotencyKey()}`,
          idempotencyKey: idempotencyKey ?? generateIdempotencyKey(),
          createdAt: new Date().toISOString(),
          attempts: 0,
        } as QueuedOfflineMutation;
        set({ queuedMutations: addMutationToQueueCancellingOppositeToggles(get().queuedMutations, queuedMutation) });
      },
      replayQueuedMutationsInOrder: async () => {
        if (get().isReplayingQueuedMutations || !get().isOnline) return;
        set({ isReplayingQueuedMutations: true });
        try {
          while (get().isOnline) {
            const nextMutation = get().queuedMutations[0];
            if (!nextMutation) return;
            const removeMutationFromQueue = () =>
              set({ queuedMutations: get().queuedMutations.filter((queued) => queued.id !== nextMutation.id) });
            try {
              await sendQueuedOfflineMutationToServer(nextMutation);
              removeMutationFromQueue();
              offlineMutationReplayedListeners.forEach((listener) => listener(nextMutation));
            } catch (error) {
              const attemptsSoFar = nextMutation.attempts + 1;
              if (!isRetryableApiFailure(error) || attemptsSoFar >= MAXIMUM_REPLAY_ATTEMPTS_BEFORE_DROPPING) {
                removeMutationFromQueue();
                handleOfflineMutationPermanentlyDropped(nextMutation);
                offlineMutationReplayedListeners.forEach((listener) => listener(nextMutation));
                continue;
              }
              set({
                queuedMutations: get().queuedMutations.map((queued) =>
                  queued.id === nextMutation.id ? { ...queued, attempts: attemptsSoFar } : queued,
                ),
              });
              scheduleReplayRetryAfterBackoff(attemptsSoFar);
              return;
            }
          }
        } finally {
          set({ isReplayingQueuedMutations: false });
        }
      },
      clearQueuedMutations: () => set({ queuedMutations: [] }),
    }),
    {
      name: "zm.offlineMutationQueue",
      storage: createJSONStorage(() => sealedAsyncStorage(AsyncStorage)),
      partialize: (state) => ({ queuedMutations: state.queuedMutations }),
      onRehydrateStorage: () => (state) => {
        state?.replayQueuedMutationsInOrder().catch(() => undefined);
      },
    },
  ),
);

export async function runNowOrQueueWhenOffline<T>(
  mutation: OfflineMutation,
  sendToServerNow: (idempotencyKey: string) => Promise<T>,
): Promise<T | undefined> {
  const idempotencyKey = generateIdempotencyKey();
  const { isOnline, enqueueMutationForReplayWhenOnline } = useOfflineStore.getState();
  if (!isOnline) {
    enqueueMutationForReplayWhenOnline(mutation, idempotencyKey);
    return undefined;
  }
  try {
    return await sendToServerNow(idempotencyKey);
  } catch (error) {
    if (!isNetworkFailureError(error)) throw error;
    enqueueMutationForReplayWhenOnline(mutation, idempotencyKey);
    return undefined;
  }
}

export const isDeviceConnectedAccordingToNetInfo = (state: NetInfoState) => state.isConnected !== false;

export function startOfflineConnectivityMonitoring() {
  return NetInfo.addEventListener((state) => useOfflineStore.getState().setOnlineStatus(isDeviceConnectedAccordingToNetInfo(state)));
}

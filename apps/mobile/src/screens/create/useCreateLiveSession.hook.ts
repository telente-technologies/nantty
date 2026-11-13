import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { buildLiveMonetizationInput, DEFAULT_LIVE_MONETIZATION_DRAFT, type LiveMonetizationDraft } from "@/components/create/liveMonetization.constant";
import type { LiveStreamCredentials } from "@/components/create/liveSetupPanel";
import { useLiveHostStore } from "@/components/live/liveHostStore.hook";
import { canPreviewLiveHostingWithMocks, decideLiveHostingGate, detectLiveHostingSupport, type LiveHostingGateKind } from "@/services/live/liveHostingSupport.service";
import { ensureLiveCameraAndMicrophone, promptToEnableLiveMediaInSettings } from "@/services/live/liveMediaPermissions.service";
import { liveService } from "@/services/live/live.service";
import { useToastStore } from "@/store/toast.store";
import type { MainScreenProps } from "@/navigation/navigation.types";
import type { LiveCategory, LiveSource } from "@/types";
import { readLiveErrorMessage, readRunningLiveId } from "@/utils/liveStoreErrors.util";

interface UseCreateLiveSessionOptions {
  readonly canGoLive: boolean;
  readonly navigation: MainScreenProps<"CreatePost">["navigation"];
}

export function useCreateLiveSession({ canGoLive, navigation }: UseCreateLiveSessionOptions) {
  const [title, setTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [source, setSource] = useState<LiveSource>("camera");
  const [category, setCategory] = useState<LiveCategory>("justChatting");
  const [monetization, setMonetization] = useState<LiveMonetizationDraft>(DEFAULT_LIVE_MONETIZATION_DRAFT);
  const [credentials, setCredentials] = useState<LiveStreamCredentials | null>(null);
  const [hostingGate, setHostingGate] = useState<LiveHostingGateKind | null>(null);
  const [hasAcceptedMockPreview, setHasAcceptedMockPreview] = useState(false);
  const isStarting = useRef(false);
  const hostStore = useLiveHostStore();
  const showToast = useToastStore((state) => state.showToast);

  const goLive = useMutation({
    mutationFn: async () => {
      if (!canGoLive) throw new Error("Join the Creator Program to go live");
      const liveCategory = category === "shopping" && !hostStore.storeId ? "justChatting" : category;
      const session = await liveService.startLiveSessionWithTitle(
        title || "Live on Nantty",
        liveCategory,
        buildLiveMonetizationInput(monetization),
        hostStore.storeId,
      );
      if (source !== "external") return { session, credentials: null as LiveStreamCredentials | null };
      const issued = await liveService.issueStreamKey(session.id);
      return { session, credentials: { liveId: session.id, ...issued } satisfies LiveStreamCredentials };
    },
    onSuccess: ({ session, credentials: issuedCredentials }) => {
      if (issuedCredentials) {
        setCredentials(issuedCredentials);
        return;
      }
      navigation.replace("Live", { liveId: session.id, host: true });
    },
    onError: (error) => {
      const runningLiveId = readRunningLiveId(error);
      if (runningLiveId) {
        navigation.replace("Live", { liveId: runningLiveId, host: true });
        return;
      }
      showToast(readLiveErrorMessage(
        error,
        error instanceof Error && error.message ? error.message : "We couldn't start your live. Try again.",
      ));
    },
  });

  const start = async () => {
    if (isStarting.current || goLive.isPending) return;
    const gate = decideLiveHostingGate(detectLiveHostingSupport(), source, hasAcceptedMockPreview);
    if (gate) {
      setHostingGate(gate);
      return;
    }
    isStarting.current = true;
    try {
      if (source !== "external" && (await ensureLiveCameraAndMicrophone(source === "camera")) === "denied") {
        promptToEnableLiveMediaInSettings(source === "camera");
        return;
      }
      await goLive.mutateAsync().catch(() => undefined);
    } finally {
      isStarting.current = false;
    }
  };

  return {
    title,
    setTitle,
    isEditingTitle,
    startEditingTitle: () => setIsEditingTitle(true),
    finishEditingTitle: () => setIsEditingTitle(false),
    source,
    setSource: (next: LiveSource) => {
      setSource(next);
      if (next !== "external") setCredentials(null);
    },
    category,
    setCategory,
    monetization,
    setMonetization,
    credentials,
    hostStore,
    canSell: Boolean(hostStore.storeId),
    goLive,
    start,
    openLiveRoom: (liveId: string) => navigation.replace("Live", { liveId, host: true }),
    hostingGate,
    setHostingGate,
    hasAcceptedMockPreview,
    acceptMockPreview: () => {
      setHasAcceptedMockPreview(true);
      setHostingGate(null);
    },
    canPreviewWithMocks: canPreviewLiveHostingWithMocks,
  };
}

import { create } from "zustand";

export interface ActiveLiveLocationShare {
  readonly messageId: string;
  readonly conversationId: string;
  readonly liveUntil: string;
}

interface LiveLocationSharesState {
  readonly sharesByMessageId: Readonly<Record<string, ActiveLiveLocationShare>>;
  readonly addShare: (share: ActiveLiveLocationShare) => void;
  readonly removeShare: (messageId: string) => void;
}

export const useLiveLocationSharesStore = create<LiveLocationSharesState>((set) => ({
  sharesByMessageId: {},
  addShare: (share) => set((state) => ({ sharesByMessageId: { ...state.sharesByMessageId, [share.messageId]: share } })),
  removeShare: (messageId) =>
    set((state) => {
      const { [messageId]: _removed, ...rest } = state.sharesByMessageId;
      return { sharesByMessageId: rest };
    }),
}));

export const useIsSharingLiveLocation = (messageId: string) => useLiveLocationSharesStore((state) => !!state.sharesByMessageId[messageId]);

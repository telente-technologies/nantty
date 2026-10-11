import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ID, PostAudience } from "@/types";
import type { MentionEntity } from "@/types/mention.type";
import type { LocalMediaFile } from "@/services/media/mediaPreparation.service";
import type { PostSettingsValue } from "@/components/create/settings/postSettings.type";
import type { ClipEdits } from "@/components/create/clip/clipDraft.util";

export type ComposerDraftKind = "post" | "clip";

export interface ComposerDraftMedia extends LocalMediaFile {}

export interface ComposerDraft {
  readonly id: ID;
  readonly kind: ComposerDraftKind;
  readonly updatedAt: string;
  readonly text: string;
  readonly mentions: readonly MentionEntity[];
  readonly audience: PostAudience;
  readonly settings: PostSettingsValue;
  readonly soundId: ID | null;
  readonly files: readonly ComposerDraftMedia[];
  readonly photoDurations: readonly number[];
  readonly trim: ClipEdits["trim"];
  readonly transition: ClipEdits["transition"];
  readonly look: ClipEdits["look"];
  readonly quotedPostId?: ID | null;
}

export interface ComposerDraftInput extends Omit<ComposerDraft, "id" | "updatedAt"> {}

const MAXIMUM_DRAFTS = 20;

interface ComposerDraftsState {
  readonly drafts: readonly ComposerDraft[];
  readonly isDraftsSheetOpen: boolean;
  readonly openDraftsSheet: () => void;
  readonly closeDraftsSheet: () => void;
  readonly saveDraft: (input: ComposerDraftInput) => ID;
  readonly deleteDraft: (id: ID) => void;
}

const newDraftId = () => `draft_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;

export const useComposerDraftsStore = create<ComposerDraftsState>()(
  persist(
    (set) => ({
      drafts: [],
      isDraftsSheetOpen: false,
      openDraftsSheet: () => set({ isDraftsSheetOpen: true }),
      closeDraftsSheet: () => set({ isDraftsSheetOpen: false }),
      saveDraft: (input) => {
        const id = newDraftId();
        const draft: ComposerDraft = { ...input, id, updatedAt: new Date().toISOString() };
        set((state) => ({ drafts: [draft, ...state.drafts].slice(0, MAXIMUM_DRAFTS), isDraftsSheetOpen: false }));
        return id;
      },
      deleteDraft: (id) => set((state) => ({ drafts: state.drafts.filter((draft) => draft.id !== id) })),
    }),
    { name: "zudomart.composerDrafts", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

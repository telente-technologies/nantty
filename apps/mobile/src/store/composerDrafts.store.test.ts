jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import { useComposerDraftsStore } from "./composerDrafts.store";
import { EMPTY_CLIP_EDITS } from "@/components/create/clip/clipDraft.util";
import { DEFAULT_POST_SETTINGS } from "@/components/create/settings/postSettings.type";

describe("composer draft persistence state", () => {
  beforeEach(() => {
    useComposerDraftsStore.setState({ drafts: [], isDraftsSheetOpen: false });
  });

  it("clears local composer drafts and closes the draft sheet on account sign-out", () => {
    const store = useComposerDraftsStore.getState();
    store.saveDraft({
      kind: "post",
      text: "A private unsent post",
      mentions: [],
      audience: "everyone",
      settings: DEFAULT_POST_SETTINGS,
      soundId: null,
      files: [],
      photoDurations: [],
      trim: EMPTY_CLIP_EDITS.trim,
      transition: EMPTY_CLIP_EDITS.transition,
      look: EMPTY_CLIP_EDITS.look,
    });
    useComposerDraftsStore.getState().openDraftsSheet();

    useComposerDraftsStore.getState().clearDrafts();

    expect(useComposerDraftsStore.getState().drafts).toEqual([]);
    expect(useComposerDraftsStore.getState().isDraftsSheetOpen).toBe(false);
  });
});

import { ApiError } from "@/errors/api.error";
import type { ClipSound, CopyrightClaimInput, UpdateSoundInput } from "@/types";

import { findMockClipsByIds } from "./clips.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import {
  buildClipSoundFromState,
  clipIdsUsingSound,
  findMutableSoundState,
  listAllMutableSoundStates,
  savedSoundIdsForViewer,
} from "./soundCatalog.mock";

const SOUND_CLIPS_PAGE_SIZE = 9;
const receivedCopyrightClaims: CopyrightClaimInput[] = [];

const findSoundStateOrThrow = (soundId: string) => {
  const state = findMutableSoundState(soundId);
  if (!state) throw new ApiError(404, "Sound not found", "SOUND_NOT_FOUND");
  return state;
};

const allVisibleSounds = (): ClipSound[] =>
  listAllMutableSoundStates()
    .filter((state) => state.status !== "removed")
    .map(buildClipSoundFromState);

export const soundsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/sounds", ({ query }) => {
    const term = (query.get("q") ?? "").trim().toLowerCase();
    return allVisibleSounds().filter(
      (sound) => !term || sound.title.toLowerCase().includes(term) || sound.owner.username.toLowerCase().includes(term),
    );
  }),
  createMockRoute("GET", "/api/v1/sounds/trending", () =>
    allVisibleSounds()
      .filter((sound) => sound.status === "available")
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 8),
  ),
  createMockRoute("GET", "/api/v1/sounds/saved", () => allVisibleSounds().filter((sound) => savedSoundIdsForViewer.has(sound.id))),
  createMockRoute("GET", "/api/v1/sounds/:soundId", ({ params }) => buildClipSoundFromState(findSoundStateOrThrow(params.soundId!))),
  createMockRoute("GET", "/api/v1/sounds/:soundId/clips", ({ params, query }) => {
    findSoundStateOrThrow(params.soundId!);
    const clips = findMockClipsByIds(clipIdsUsingSound(params.soundId!));
    const start = Number(query.get("cursor") ?? 0) || 0;
    const end = start + SOUND_CLIPS_PAGE_SIZE;
    return { data: clips.slice(start, end), nextCursor: end < clips.length ? String(end) : null };
  }),
  createMockRoute("PATCH", "/api/v1/sounds/:soundId", ({ params, body }) => {
    const state = findSoundStateOrThrow(params.soundId!);
    const signedInUserId = getSignedInMockUser().id;
    if (state.ownerId !== signedInUserId) throw new ApiError(403, "Only the sound's owner can change it", "NOT_SOUND_OWNER");
    const input = body as UpdateSoundInput;
    if (input.title !== undefined) {
      const trimmedTitle = input.title.trim().slice(0, 80);
      if (!trimmedTitle) throw new ApiError(422, "Give your sound a name", "SOUND_TITLE_REQUIRED");
      state.title = trimmedTitle;
      state.isOriginal = trimmedTitle.toLowerCase() === "original sound";
    }
    if (input.allowReuse !== undefined) state.allowReuse = input.allowReuse;
    return buildClipSoundFromState(state);
  }),
  createMockRoute("POST", "/api/v1/sounds/:soundId/save", ({ params }) => {
    findSoundStateOrThrow(params.soundId!);
    savedSoundIdsForViewer.add(params.soundId!);
  }),
  createMockRoute("DELETE", "/api/v1/sounds/:soundId/save", ({ params }) => {
    savedSoundIdsForViewer.delete(params.soundId!);
  }),
  createMockRoute("POST", "/api/v1/copyright/claims", ({ body }) => {
    const claim = body as CopyrightClaimInput;
    if (!claim.goodFaith) throw new ApiError(422, "The good-faith declaration is required", "GOOD_FAITH_REQUIRED");
    if (!claim.accuracyDeclared) throw new ApiError(422, "The accuracy declaration is required", "ACCURACY_DECLARATION_REQUIRED");
    if (claim.signatureName?.trim().toLowerCase() !== claim.claimantName?.trim().toLowerCase()) throw new ApiError(422, "Type your full name as your electronic signature", "SIGNATURE_REQUIRED");
    receivedCopyrightClaims.push(claim);
    if (claim.targetType === "sound") {
      const state = findMutableSoundState(claim.targetId);
      if (state) state.status = "under_copyright_review";
    }
    return { claimId: `cc_${Date.now().toString(36)}`, status: "received" };
  }),
];

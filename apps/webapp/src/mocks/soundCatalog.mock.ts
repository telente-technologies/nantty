import type { ClipSound, ClipSoundStatus } from "@/types";

import { clipVideoSeeds, type ClipVideoSeed } from "./clipsVideoCatalog.mock";
import { getSignedInMockUser, me } from "./fixtures.mock";
import { userSummaryById } from "./userDirectory.mock";

interface MutableSoundState {
  readonly id: string;
  readonly ownerId: ClipVideoSeed["authorId"] | "u_me";
  readonly sourceClipId: string | null;
  readonly audioUrl: string | null;
  readonly coverUrl: string | null;
  readonly baseUsageCount: number;
  title: string;
  isOriginal: boolean;
  allowReuse: boolean;
  status: ClipSoundStatus;
}

const NAMED_SOUND_TITLES: Readonly<Record<string, string>> = {
  snd_amaka_haul: "Balogun market groove",
  snd_olumide_barber: "Barbershop afro loop",
  snd_aisha_fitcheck: "Ikoyi brunch vibes",
  snd_nkechi_zobo: "Zobo o'clock",
};

const REUSED_SOUND_ID_BY_CLIP_ID: Readonly<Record<string, string>> = {
  clip_chinedu_lowcut: "snd_olumide_barber",
  clip_hauwa_dms: "snd_me_afrobeats_hook",
  clip_blessing_wedding: "snd_aisha_fitcheck",
};

const SOUND_IDS_THAT_BLOCK_REUSE = new Set(["snd_tunde_earbuds"]);
const SOUND_IDS_UNDER_COPYRIGHT_REVIEW = new Set(["snd_dami_break"]);

export const originalSoundIdForClip = (clipId: string) => clipId.replace(/^clip_/, "snd_");

const soundStatesById = new Map<string, MutableSoundState>(
  clipVideoSeeds
    .filter((seed) => !REUSED_SOUND_ID_BY_CLIP_ID[seed.id])
    .map((seed, index) => {
      const soundId = originalSoundIdForClip(seed.id);
      const namedTitle = NAMED_SOUND_TITLES[soundId];
      return [
        soundId,
        {
          id: soundId,
          ownerId: seed.authorId,
          sourceClipId: seed.id,
          audioUrl: seed.hlsUrl ? null : seed.videoUrl,
          coverUrl: seed.posterUrl,
          baseUsageCount: namedTitle ? 1_200 + index * 377 : index * 3,
          title: namedTitle ?? "Original sound",
          isOriginal: !namedTitle,
          allowReuse: !SOUND_IDS_THAT_BLOCK_REUSE.has(soundId),
          status: SOUND_IDS_UNDER_COPYRIGHT_REVIEW.has(soundId) ? "under_copyright_review" : "available",
        },
      ] as const;
    }),
);

const ownSeedForViewerSound = clipVideoSeeds.find((seed) => seed.id === "clip_hauwa_dms");
soundStatesById.set("snd_me_afrobeats_hook", {
  id: "snd_me_afrobeats_hook",
  ownerId: "u_me",
  sourceClipId: null,
  audioUrl: ownSeedForViewerSound?.videoUrl ?? null,
  coverUrl: ownSeedForViewerSound?.posterUrl ?? null,
  baseUsageCount: 42,
  title: "My afrobeats hook",
  isOriginal: false,
  allowReuse: true,
  status: "available",
});

export const savedSoundIdsForViewer = new Set<string>(["snd_amaka_haul"]);

export const soundIdForClip = (clipId: string) => REUSED_SOUND_ID_BY_CLIP_ID[clipId] ?? originalSoundIdForClip(clipId);

export const clipIdsUsingSound = (soundId: string) => clipVideoSeeds.map((seed) => seed.id).filter((clipId) => soundIdForClip(clipId) === soundId);

export const findMutableSoundState = (soundId: string) => soundStatesById.get(soundId);

export const listAllMutableSoundStates = () => [...soundStatesById.values()];

const resolveSoundOwnerSummary = (state: MutableSoundState) =>
  state.ownerId === "u_me" ? me : userSummaryById(state.ownerId);

export function buildClipSoundFromState(state: MutableSoundState): ClipSound {
  return {
    id: state.id,
    title: state.title,
    owner: resolveSoundOwnerSummary(state),
    isOriginal: state.isOriginal,
    allowReuse: state.allowReuse,
    status: state.status,
    usageCount: state.baseUsageCount + clipIdsUsingSound(state.id).length,
    audioUrl: state.status === "available" ? state.audioUrl : null,
    coverUrl: state.coverUrl,
    sourceClipId: state.sourceClipId,
    savedByViewer: savedSoundIdsForViewer.has(state.id),
  };
}

export function currentSoundForClip(clipId: string): ClipSound {
  const state = soundStatesById.get(soundIdForClip(clipId));
  if (state) return buildClipSoundFromState(state);
  const signedInUser = getSignedInMockUser();
  return {
    id: originalSoundIdForClip(clipId),
    title: "Original sound",
    owner: signedInUser,
    isOriginal: true,
    allowReuse: true,
    status: "available",
    usageCount: 1,
  };
}

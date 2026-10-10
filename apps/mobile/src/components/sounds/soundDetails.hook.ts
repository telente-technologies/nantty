import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { soundsService } from "@/services/clips/sounds.service";
import type { ClipSound, ID, UpdateSoundInput } from "@/types";

export const soundQueryKey = (soundId: ID) => ["sound", soundId] as const;

export function useSoundDetails(soundId: ID) {
  const queryClient = useQueryClient();
  const sound = useQuery({ queryKey: soundQueryKey(soundId), queryFn: () => soundsService.fetchSoundById(soundId) });
  const clipsUsingSound = useInfiniteQuery({
    queryKey: ["sound-clips", soundId],
    queryFn: ({ pageParam }) => soundsService.fetchClipsUsingSound(soundId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const clips = useMemo(() => clipsUsingSound.data?.pages.flatMap((page) => page.data) ?? [], [clipsUsingSound.data]);

  const replaceCachedSound = (change: (current: ClipSound) => ClipSound) =>
    queryClient.setQueryData<ClipSound>(soundQueryKey(soundId), (current) => (current ? change(current) : current));

  const toggleSavedSound = useMutation({
    mutationFn: (wasSaved: boolean) => (wasSaved ? soundsService.unsaveSound(soundId) : soundsService.saveSound(soundId)),
    onMutate: (wasSaved) => replaceCachedSound((current) => ({ ...current, savedByViewer: !wasSaved })),
    onError: (_, wasSaved) => replaceCachedSound((current) => ({ ...current, savedByViewer: wasSaved })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["sounds", "saved"] }),
  });

  const updateSoundAsOwner = useMutation({
    mutationFn: (input: UpdateSoundInput) => soundsService.updateSoundAsOwner(soundId, input),
    onSuccess: (updatedSound) => {
      queryClient.setQueryData(soundQueryKey(soundId), updatedSound);
      queryClient.invalidateQueries({ queryKey: ["clips"] });
    },
  });

  return { sound, clipsUsingSound, clips, toggleSavedSound, updateSoundAsOwner };
}

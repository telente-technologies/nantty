"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { usersService } from "@/services/users.service";

import styles from "./settings.module.css";

export function ProfileVisibilitySection() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["profile", "me"], queryFn: () => usersService.fetchMyProfile(), retry: false });
  const save = useMutation({
    mutationFn: (isPrivate: boolean) => usersService.updateMyProfileDetails({ isPrivate }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile", "me"], updated);
      void queryClient.invalidateQueries({ queryKey: ["followRequests"] });
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });
  const isPrivate = save.isPending ? save.variables === true : profile.data?.isPrivate === true;
  return (
    <section aria-labelledby="profile-visibility-heading" className={styles.block}>
      <h2 id="profile-visibility-heading" className={styles.blockHeading}>Profile visibility</h2>
      <div className={styles.buttonRow} role="radiogroup" aria-labelledby="profile-visibility-heading">
        {([false, true] as const).map((option) => (
          <button key={String(option)} type="button" role="radio" aria-checked={isPrivate === option} className={styles.choiceChip} disabled={save.isPending || profile.isLoading} onClick={() => save.mutate(option)}>
            {option ? "Private" : "Public"}
          </button>
        ))}
      </div>
      <p className={styles.muted}>
        {isPrivate ? "Only approved followers can see your posts, followers and following. New followers need your approval." : "Anyone can see your posts and follow you."}
        {" Review follow requests from the menu on your profile."}
      </p>
    </section>
  );
}

import { useState } from "react";

import { Analytics24Icon, Flag24Icon, Trash24Icon, UserCircle24Icon } from "@/components/icons";
import { useDeleteOwnPost } from "@/components/feed/useDeleteOwnPost.hook";
import { useIsOwnPost } from "@/hooks/useIsOwnPost.hook";
import { ReportSheet, type ReportTarget } from "@/components/moderation/reportSheet";
import { ActionSheet, type ActionSheetOption } from "@/components/ui/actionSheet";
import { useAuthStore } from "@/store/auth.store";
import type { Story } from "@/types";
import { requireAuthAfterClosingModal } from "@/utils/requireAuth.util";

export interface StoryOptionsSheetProps {
  readonly story: Story | undefined;
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onOpenProfile: (userId: string) => void;
  readonly onOpenAnalytics: (storyId: string) => void;
  readonly onReportClosed: () => void;
  readonly onDeleted?: (storyId: string) => void;
}

export function StoryOptionsSheet({ story, visible, onClose, onOpenProfile, onOpenAnalytics, onReportClosed, onDeleted }: StoryOptionsSheetProps) {
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const ownsViaProfile = useIsOwnPost(story ?? { author: { id: "" } });
  const { confirmAndDelete } = useDeleteOwnPost({ onDeleted: (deleted) => onDeleted?.(deleted.id) });
  if (!story) return null;
  const isOwnStory = story.author.id === signedInUserId || ownsViaProfile;
  const options: ActionSheetOption[] = [
    { label: isOwnStory ? "View my profile" : `View @${story.author.username}`, icon: <UserCircle24Icon />, onPress: () => onOpenProfile(story.author.id) },
  ];
  if (isOwnStory) {
    options.push({ label: "Story analytics", icon: <Analytics24Icon />, onPress: () => onOpenAnalytics(story.id) });
    options.push({ label: "Delete", icon: <Trash24Icon />, destructive: true, onPress: () => { onClose(); confirmAndDelete({ id: story.id, kind: "story" }); } });
  }
  if (!isOwnStory) {
    options.push({
      label: "Report",
      icon: <Flag24Icon />,
      destructive: true,
      onPress: () => {
        const opened = requireAuthAfterClosingModal(onClose, () => setReportTarget({ targetType: "user", targetId: story.author.id }), "report");
        if (!opened) onReportClosed();
      },
    });
  }
  return (
    <>
      <ActionSheet visible={visible} onClose={onClose} options={options} title={story.author.name} />
      <ReportSheet
        target={reportTarget}
        onClose={() => {
          setReportTarget(null);
          onReportClosed();
        }}
      />
    </>
  );
}

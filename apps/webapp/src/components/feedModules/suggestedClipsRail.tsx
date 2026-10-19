"use client";

import { useState } from "react";

import { useSession } from "@/components/providers/sessionProvider";
import { AppIcon, type AppIconName } from "@/components/ui/appIcon";
import { Button } from "@/components/ui/button";
import { MediaImage } from "@/components/ui/media";
import { ModalDialog } from "@/components/ui/modalDialog";
import { usePopoverMenu } from "@/components/ui/popoverMenu.hook";
import { showToast } from "@/components/ui/toast";
import { suggestedClipsHiddenDays, suggestedClipsNotInterestedCooldownDays } from "@/config/feedModules.config";
import { feedsService } from "@/services/feeds.service";
import { useFeedModulePreferencesStore } from "@/store/feedModulePreferences.store";
import type { Clip } from "@/types";

import styles from "./feedModules.module.css";

const reasonsForSuggestedClips = [
  "They're popular with people who watch clips like the ones you've liked, shared or watched to the end.",
  "Some come from creators you don't follow yet, so you can discover new people.",
  "They never come from accounts you've blocked.",
  "Use the menu on the row to see fewer of them or hide them for a while.",
];

export interface SuggestedClipsRailProps {
  readonly clips: readonly Clip[];
  readonly onOpenClip: (clip: Clip) => void;
}

export function SuggestedClipsRail({ clips, onOpenClip }: SuggestedClipsRailProps) {
  const viewerId = useSession().viewer?.id ?? null;
  const hideSuggestedClipsForDays = useFeedModulePreferencesStore((state) => state.hideSuggestedClipsForDays);
  const menu = usePopoverMenu();
  const [explanationOpen, setExplanationOpen] = useState(false);

  const options: readonly { readonly label: string; readonly detail?: string; readonly icon: AppIconName; readonly run: () => void }[] = [
    {
      label: "Not interested in these",
      detail: "We'll show fewer clips like these",
      icon: "prohibit24",
      run: () => {
        hideSuggestedClipsForDays(viewerId, suggestedClipsNotInterestedCooldownDays);
        if (viewerId !== null) void feedsService.sendShowFewerClipsLikeThese(clips.map((clip) => clip.id));
        showToast({ text: "Got it. You'll see fewer clips like these." });
      },
    },
    {
      label: `Hide suggested videos for ${suggestedClipsHiddenDays} days`,
      icon: "eyeSlash24",
      run: () => {
        hideSuggestedClipsForDays(viewerId, suggestedClipsHiddenDays);
        showToast({ text: `Suggested videos are hidden for ${suggestedClipsHiddenDays} days.` });
      },
    },
    { label: "Why am I seeing this?", icon: "info24", run: () => setExplanationOpen(true) },
  ];

  return (
    <section className={styles.module} aria-label="Suggested clips">
      <div className={styles.header} ref={menu.containerRef}>
        <h2 className={styles.title}>Suggested clips</h2>
        <button type="button" ref={menu.triggerRef} className={styles.iconButton} aria-label="More options for suggested clips" {...menu.triggerProps}>
          <AppIcon name="dotsThreeVertical24" size={20} />
        </button>
        {menu.isOpen ? (
          <div ref={menu.menuRef} className={styles.menuPanel} {...menu.menuProps} aria-label="Suggested clips options">
            {options.map((option) => (
              <button
                key={option.label}
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() => {
                  menu.close(option.icon !== "info24");
                  option.run();
                }}
              >
                <AppIcon name={option.icon} size={20} />
                <span className={styles.menuItemText}>
                  {option.label}
                  {option.detail ? <span className={styles.menuItemDetail}>{option.detail}</span> : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <ul className={styles.slider}>
        {clips.map((clip) => {
          const poster = clip.media[0]?.posterUrl ?? null;
          return (
            <li key={clip.id}>
              <button type="button" className={styles.clipTile} onClick={() => onOpenClip(clip)} aria-label={`Play suggested clip by ${clip.author.name}`}>
                <MediaImage src={poster} alt="" sizes="140px" />
                <span className={styles.clipTileAuthor} aria-hidden="true">{clip.author.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <ModalDialog isOpen={explanationOpen} title="Why you're seeing suggested clips" onClose={() => setExplanationOpen(false)} footer={<Button onClick={() => setExplanationOpen(false)}>Got it</Button>}>
        <ul className={styles.reasons}>
          {reasonsForSuggestedClips.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      </ModalDialog>
    </section>
  );
}

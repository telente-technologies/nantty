"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { showToast } from "@/components/ui/toast";
import { replyPolicyLabel, replyPolicyOptions } from "@/config/postAudience.config";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { postsService } from "@/services/posts.service";
import type { Post, ReplyPolicy } from "@/types";

import settingsStyles from "@/components/settings/settings.module.css";
import styles from "./thread.module.css";

export function ReplySettingsControl({ post }: { readonly post: Post }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const current = post.replyPolicy ?? "everyone";
  const update = useMutation({
    mutationFn: (replyPolicy: ReplyPolicy) => postsService.updateReplySettings(post.id, replyPolicy),
    onSuccess: (updated) => {
      queryClient.setQueryData(["post", post.id], updated);
      showToast({ text: "Reply settings saved" });
      setIsOpen(false);
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });
  return (
    <div className={styles.replySettings}>
      <span>
        Who can reply: <strong>{replyPolicyLabel(current)}</strong>
      </span>
      <button type="button" className={styles.textAction} onClick={() => setIsOpen(true)} aria-haspopup="dialog">
        Change
      </button>
      <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)} title="Who can reply?" description="Choose who can reply to this post. You can always reply." layout="centered" size="small">
        <fieldset className={settingsStyles.radioGroup} disabled={update.isPending}>
          <legend className="visuallyHidden">Who can reply</legend>
          {replyPolicyOptions.map((option) => (
            <label key={option.value} className={settingsStyles.radioRow}>
              <input type="radio" name={`reply-policy-${post.id}`} value={option.value} checked={current === option.value} onChange={() => update.mutate(option.value)} />
              <span>
                <span className={settingsStyles.toggleLabel}>{option.label}</span>
                <span className={settingsStyles.muted}>{option.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </Dialog>
    </div>
  );
}

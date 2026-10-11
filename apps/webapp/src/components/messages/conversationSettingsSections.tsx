"use client";

import { useMutation } from "@tanstack/react-query";

import { ConsentToggleRow } from "@/components/settings/consentToggleRow";
import settingsStyles from "@/components/settings/settings.module.css";
import { chatGroupsService } from "@/services/chatGroups.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import type { ChatMuteDuration, Conversation, ConversationSettingsUpdate } from "@/types";

export const disappearingChoices: readonly { readonly label: string; readonly seconds: number | null }[] = [
  { label: "Off", seconds: null },
  { label: "24 hours", seconds: 86_400 },
  { label: "7 days", seconds: 604_800 },
];

export const muteChoices: readonly { readonly label: string; readonly duration: ChatMuteDuration }[] = [
  { label: "Unmuted", duration: "off" },
  { label: "8 hours", duration: "8h" },
  { label: "1 week", duration: "1w" },
  { label: "Always", duration: "always" },
];

export function currentMuteDuration(mutedUntil: string | null | undefined, now: Date): ChatMuteDuration | null {
  if (!mutedUntil) return "off";
  if (mutedUntil === "always") return "always";
  return new Date(mutedUntil) > now ? null : "off";
}

interface Props {
  readonly conversation: Conversation;
  readonly isAdmin: boolean;
  readonly onChanged: () => void;
}

export function ConversationSettingsSections({ conversation, isAdmin, onChanged }: Props) {
  const isGroup = conversation.kind === "group";
  const isChannel = conversation.kind === "channel";
  const update = useMutation({ mutationFn: (change: ConversationSettingsUpdate) => chatGroupsService.updateSettings(conversation.id, change), onSuccess: onChanged });
  const mute = useMutation({ mutationFn: (duration: ChatMuteDuration) => chatGroupsService.setMute(conversation.id, duration), onSuccess: onChanged });
  const canChangeDisappearing = !isChannel && (!isGroup || isAdmin);
  const mutedChoice = currentMuteDuration(conversation.mutedUntil, new Date());
  const error = update.error ?? mute.error;
  return (
    <>
      {canChangeDisappearing ? (
        <section className={settingsStyles.block}>
          <h2 className={settingsStyles.blockHeading}>Disappearing messages</h2>
          <p className={settingsStyles.muted}>New messages will disappear from this chat after the time you choose.</p>
          <div role="radiogroup" aria-label="Disappearing messages" className={settingsStyles.buttonRow}>
            {disappearingChoices.map((choice) => (
              <button
                key={choice.label}
                type="button"
                role="radio"
                className={settingsStyles.choiceChip}
                aria-checked={(conversation.disappearingMessagesSeconds ?? null) === choice.seconds}
                disabled={update.isPending}
                onClick={() => update.mutate({ disappearingMessagesSeconds: choice.seconds })}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <section className={settingsStyles.block}>
        <h2 className={settingsStyles.blockHeading}>Mute notifications</h2>
        {mutedChoice === null && conversation.mutedUntil ? <p className={settingsStyles.muted}>Muted until {new Date(conversation.mutedUntil).toLocaleString()}</p> : null}
        <div role="radiogroup" aria-label="Mute notifications" className={settingsStyles.buttonRow}>
          {muteChoices.map((choice) => (
            <button key={choice.duration} type="button" role="radio" className={settingsStyles.choiceChip} aria-checked={mutedChoice === choice.duration} disabled={mute.isPending} onClick={() => mute.mutate(choice.duration)}>
              {choice.label}
            </button>
          ))}
        </div>
      </section>
      {isGroup && isAdmin ? (
        <section className={settingsStyles.block}>
          <ConsentToggleRow
            label="Only admins can @all"
            description="When on, only admins can notify every member with @all."
            enabled={conversation.onlyAdminsCanMentionAll === true}
            disabled={update.isPending}
            onChange={(enabled) => update.mutate({ onlyAdminsCanMentionAll: enabled })}
          />
        </section>
      ) : null}
      {error ? <p className={settingsStyles.errorText} role="alert">{readErrorMessageForDisplay(error)}</p> : null}
    </>
  );
}

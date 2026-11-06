"use client";

import type { GroupAttributes } from "@nantty/chat-crypto";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import settingsStyles from "@/components/settings/settings.module.css";
import { Button } from "@/components/ui/button";
import { requestConfirmation } from "@/components/ui/confirmDialog";
import { Avatar } from "@/components/ui/media";
import { readChatCryptoErrorMessage } from "@/services/chatCrypto/chatCrypto.service";
import { chatGroupsService } from "@/services/chatGroups.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import type { Conversation, UserSummary } from "@/types";

import listStyles from "./conversationListPanel.module.css";
import { PeoplePicker, togglePerson } from "./peoplePicker";

interface Props {
  readonly conversation: Conversation;
  readonly viewerId: string;
  readonly canManage: boolean;
  readonly attributes: GroupAttributes | null;
  readonly onChanged: () => void;
}

const roleLabels = { owner: "Owner", admin: "Admin", member: "" } as const;

export function GroupMembersSection({ conversation, viewerId, canManage, attributes, onChanged }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [toAdd, setToAdd] = useState<readonly UserSummary[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [toInvite, setToInvite] = useState<readonly UserSummary[]>([]);
  const [invitationNotice, setInvitationNotice] = useState<string | null>(null);
  const members = useQuery({ queryKey: ["conversation-members", conversation.id], queryFn: () => chatGroupsService.fetchMembers(conversation.id) });
  const action = useMutation({ mutationFn: (run: () => Promise<unknown>) => run(), onSuccess: onChanged });
  const invite = useMutation({
    mutationFn: async (people: readonly UserSummary[]) => {
      const outcomes = await Promise.allSettled(people.map((person) => chatGroupsService.createInvitation(conversation.id, person.id)));
      return {
        sentCount: outcomes.filter((outcome) => outcome.status === "fulfilled").length,
        failedIds: outcomes.flatMap((outcome, index) => outcome.status === "rejected" ? [people[index]!.id] : []),
      };
    },
    onSuccess: ({ sentCount, failedIds }, submittedPeople) => {
      const failedPeople = submittedPeople.filter((person) => failedIds.includes(person.id));
      setToInvite(failedPeople);
      setInvitationNotice(failedIds.length > 0
        ? `${sentCount} invitation${sentCount === 1 ? "" : "s"} sent; ${failedIds.length} couldn't be sent. Retry the remaining people.`
        : `${sentCount} invitation${sentCount === 1 ? "" : "s"} sent. They must accept and complete secure key handoff before joining.`);
      if (failedIds.length === 0) setIsInviting(false);
      onChanged();
    },
  });
  const list = members.data ?? [];
  return (
    <section className={settingsStyles.block} aria-label="Members">
      <div className={settingsStyles.buttonRow}>
        <h2 className={settingsStyles.blockHeading}>{list.length} members</h2>
        {canManage ? <span className={settingsStyles.buttonRow}>
          <Button variant="ghost" size="sm" onClick={() => { setIsInviting((inviting) => !inviting); setInvitationNotice(null); }}>{isInviting ? "Cancel invite" : "Invite"}</Button>
          <Button variant="ghost" size="sm" onClick={() => setIsAdding((adding) => !adding)}>{isAdding ? "Cancel add" : "Add members"}</Button>
        </span> : null}
      </div>
      {isInviting ? (
        <div>
          <p className={settingsStyles.muted}>Search by username and send an invitation. People join only after accepting and completing secure key handoff.</p>
          <PeoplePicker selected={toInvite} excludedUserIds={list.map((member) => member.user.id)} onToggle={(person) => setToInvite((current) => togglePerson(current, person))} maximum={100} />
          <Button disabled={toInvite.length === 0} busy={invite.isPending} onClick={() => invite.mutate(toInvite)}>
            {toInvite.length > 0 ? `Send ${toInvite.length} invitation${toInvite.length === 1 ? "" : "s"}` : "Select people"}
          </Button>
          {invitationNotice ? <p className={settingsStyles.muted} role="status">{invitationNotice}</p> : null}
          {invite.isError ? <p className={settingsStyles.errorText} role="alert">{readChatCryptoErrorMessage(invite.error) ?? readErrorMessageForDisplay(invite.error)}</p> : null}
        </div>
      ) : null}
      {isAdding ? (
        <div>
          <PeoplePicker selected={toAdd} excludedUserIds={list.map((member) => member.user.id)} onToggle={(person) => setToAdd((current) => togglePerson(current, person))} maximum={100} />
          <Button
            disabled={toAdd.length === 0}
            busy={action.isPending}
            onClick={() => {
              const userIds = toAdd.map((person) => person.id);
              action.mutate(() => chatGroupsService.addMembers(conversation, viewerId, userIds));
              setToAdd([]);
              setIsAdding(false);
            }}
          >
            {toAdd.length > 0 ? `Add ${toAdd.length}` : "Add"}
          </Button>
        </div>
      ) : null}
      <ul className={listStyles.list}>
        {list.map((member) => {
          const isMe = member.user.id === viewerId;
          return (
            <li key={member.user.id} className={listStyles.row}>
              <Avatar name={member.user.name} src={member.user.avatarUrl} size="md" />
              <span className={listStyles.rowText}>
                <span className={listStyles.rowName}>{isMe ? `${member.user.name} (you)` : member.user.name}</span>
                <span className={listStyles.rowHandle}>{[`@${member.user.username}`, roleLabels[member.role]].filter(Boolean).join(" · ")}</span>
              </span>
              {canManage && !isMe && member.role !== "owner" ? (
                <span className={settingsStyles.buttonRow}>
                  {member.role === "admin" ? (
                    <Button size="sm" variant="secondary" onClick={() => action.mutate(() => chatGroupsService.demoteAdmin(conversation.id, member.user.id))}>Remove admin</Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => action.mutate(() => chatGroupsService.promoteToAdmin(conversation.id, member.user.id))}>Make admin</Button>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      if (await requestConfirmation({ title: `Remove ${member.user.name}?`, description: "They'll stop getting messages from this group. The group's encryption keys are changed.", confirmLabel: "Remove", intent: "removeMember" })) {
                        action.mutate(() => chatGroupsService.removeMember(conversation, viewerId, member.user.id, attributes));
                      }
                    }}
                  >
                    Remove
                  </Button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {action.isError ? <p className={settingsStyles.errorText} role="alert">{readChatCryptoErrorMessage(action.error) ?? readErrorMessageForDisplay(action.error)}</p> : null}
    </section>
  );
}

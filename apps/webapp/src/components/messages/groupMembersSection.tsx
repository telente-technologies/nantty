"use client";

import type { GroupAttributes } from "@zudomart/chat-crypto";
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
  const members = useQuery({ queryKey: ["conversation-members", conversation.id], queryFn: () => chatGroupsService.fetchMembers(conversation.id) });
  const action = useMutation({ mutationFn: (run: () => Promise<unknown>) => run(), onSuccess: onChanged });
  const list = members.data ?? [];
  return (
    <section className={settingsStyles.block} aria-label="Members">
      <div className={settingsStyles.buttonRow}>
        <h2 className={settingsStyles.blockHeading}>{list.length} members</h2>
        {canManage ? <Button variant="ghost" size="sm" onClick={() => setIsAdding((adding) => !adding)}>{isAdding ? "Cancel" : "Add members"}</Button> : null}
      </div>
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

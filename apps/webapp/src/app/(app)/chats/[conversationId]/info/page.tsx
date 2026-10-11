"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

import { ConversationSettingsSections } from "@/components/messages/conversationSettingsSections";
import { useConversationDisplay } from "@/components/messages/conversationDisplay.hook";
import { GroupMembersSection } from "@/components/messages/groupMembersSection";
import { useSession } from "@/components/providers/sessionProvider";
import settingsStyles from "@/components/settings/settings.module.css";
import { Button } from "@/components/ui/button";
import { requestConfirmation } from "@/components/ui/confirmDialog";
import { ErrorState } from "@/components/ui/feedback";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/media";
import { ChatMessagesSkeleton } from "@/components/ui/pageSkeletons";
import { chatCryptoService, readChatCryptoErrorMessage } from "@/services/chatCrypto/chatCrypto.service";
import { chatGroupsService } from "@/services/chatGroups.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { messagesService } from "@/services/messages.service";
import { validateGroupPhotoFile } from "@/utils/groupPhoto.util";

import styles from "../page.module.css";

export default function ConversationInfoPage({ params }: { readonly params: Promise<{ readonly conversationId: string }> }) {
  const { conversationId } = use(params);
  const { viewer } = useSession();
  const viewerId = viewer?.id ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();
  const conversationQuery = useQuery({ queryKey: ["conversations", "detail", conversationId], queryFn: () => messagesService.fetchConversationById(conversationId), retry: false });
  const conversation = conversationQuery.data;
  const display = useConversationDisplay(conversation);
  const [code, setCode] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const isGroup = conversation?.kind === "group";
  const isAdmin = conversation?.myRole === "owner" || conversation?.myRole === "admin";

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    void queryClient.invalidateQueries({ queryKey: ["chatGroupAttributes", conversationId] });
    void queryClient.invalidateQueries({ queryKey: ["conversation-members", conversationId] });
    void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
  };
  const rename = useMutation({
    mutationFn: () => {
      if (!conversation) throw new Error("Still loading.");
      return chatGroupsService.updateAttributes(conversation, viewerId, { title: (name ?? display.name).trim(), description: (description ?? display.attributes?.description ?? "").trim() || null, avatar: display.attributes?.avatar ?? null });
    },
    onSuccess: () => {
      setName(null);
      setDescription(null);
      refresh();
    },
  });
  const [photoProblem, setPhotoProblem] = useState<string | null>(null);
  const changePhoto = useMutation({
    mutationFn: async (file: File | null) => {
      if (!conversation || !display.attributes) throw new Error("Still loading.");
      const avatar = file ? await chatGroupsService.uploadGroupPhoto(file) : null;
      return chatGroupsService.setPhoto(conversation, viewerId, display.attributes, avatar);
    },
    onSuccess: refresh,
  });
  const leave = useMutation({
    mutationFn: () => chatGroupsService.leave(conversationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      router.push("/chats");
    },
  });

  if (conversationQuery.isError) return <ErrorState description="Couldn't load chat info." />;
  if (!conversation) return <ChatMessagesSkeleton label="Loading chat info" />;
  const error = rename.error ?? changePhoto.error ?? leave.error;
  const nameChanged = (name !== null && name.trim() !== "" && name.trim() !== display.name) || (description !== null && description.trim() !== (display.attributes?.description ?? ""));

  return (
    <div className={settingsStyles.page}>
      <header className={styles.header}>
        <Link href={`/chats/${conversationId}`} className={styles.back} aria-label="Back to chat">
          <ArrowLeftIcon size={20} />
        </Link>
        <span className={styles.headerName}>{isGroup ? "Group info" : conversation.kind === "channel" ? "Channel info" : "Chat info"}</span>
      </header>
      <p className={settingsStyles.muted}>Messages are end-to-end encrypted. Only people in this chat can read them.</p>
      <section className={settingsStyles.block} aria-label="Identity">
        <Avatar name={display.name} src={display.avatarSrc} size="lg" />
        <h1 className={settingsStyles.title}>{display.name}</h1>
        {display.subtitle ? <p className={settingsStyles.muted}>{display.subtitle}</p> : null}
        {isGroup && display.isEncryptedNamePending ? <p className={settingsStyles.muted}>The group name will appear once a member sends a message.</p> : null}
      </section>

      {!isGroup && conversation.kind !== "channel" ? (
        <section className={settingsStyles.block}>
          <h2 className={settingsStyles.blockHeading}>Security code</h2>
          <p className={settingsStyles.muted}>Compare this code with {conversation.peer.name} in person to check your chat is end-to-end encrypted.</p>
          {code ? <p className={settingsStyles.subHeading}>{code}</p> : <Button variant="secondary" onClick={() => void chatCryptoService.ensureReady(viewerId).then(() => chatCryptoService.securityCode(conversation.peer.id)).then(setCode)}>View security code</Button>}
        </section>
      ) : null}

      {isGroup && isAdmin && display.attributes ? (
        <section className={settingsStyles.block}>
          <h2 className={settingsStyles.blockHeading}>Group details</h2>
          <input className={styles.composerInput} aria-label="Group name" maxLength={80} value={name ?? display.name} onChange={(event) => setName(event.target.value)} />
          <input className={styles.composerInput} aria-label="Description" placeholder="Description" maxLength={500} value={description ?? display.attributes.description ?? ""} onChange={(event) => setDescription(event.target.value)} />
          {nameChanged ? <Button busy={rename.isPending} onClick={() => rename.mutate()}>Save</Button> : null}
          <label className={settingsStyles.muted}>
            Group photo (end-to-end encrypted)
            <input
              type="file"
              accept="image/*"
              aria-label="Change group photo"
              disabled={changePhoto.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const problem = validateGroupPhotoFile(file);
                setPhotoProblem(problem);
                if (!problem) changePhoto.mutate(file);
              }}
            />
          </label>
          {conversation.photoMediaId ? <Button variant="secondary" busy={changePhoto.isPending} onClick={() => changePhoto.mutate(null)}>Remove photo</Button> : null}
          {photoProblem ? <p className={settingsStyles.errorText} role="alert">{photoProblem}</p> : null}
        </section>
      ) : null}

      <ConversationSettingsSections conversation={conversation} isAdmin={isAdmin} onChanged={refresh} />
      {isGroup ? <GroupMembersSection conversation={conversation} viewerId={viewerId} canManage={isAdmin} attributes={display.attributes} onChanged={refresh} /> : null}

      {error ? <p className={settingsStyles.errorText} role="alert">{readChatCryptoErrorMessage(error) ?? readErrorMessageForDisplay(error)}</p> : null}
      {isGroup ? (
        <Button
          variant="danger"
          busy={leave.isPending}
          onClick={async () => {
            if (await requestConfirmation({ title: "Leave group?", description: "You'll stop getting messages from this group. Someone will need to add you back.", confirmLabel: "Leave group", intent: "leave" })) leave.mutate();
          }}
        >
          Leave group
        </Button>
      ) : null}
      <Link href="/chats/settings" className={settingsStyles.downloadLink}>All chat settings</Link>
    </div>
  );
}

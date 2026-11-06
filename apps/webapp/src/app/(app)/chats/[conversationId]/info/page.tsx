"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { chatGroupsService, type GroupInvitationLink } from "@/services/chatGroups.service";
import { channelsService, type ChannelInvitationLink } from "@/services/channels.service";
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
  const isChannel = conversation?.kind === "channel";
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
  const groupLinks = useInfiniteQuery({
    queryKey: ["group-invitation-links", conversationId],
    queryFn: ({ pageParam }) => chatGroupsService.listInvitationLinks(conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: isGroup && isAdmin,
    retry: false,
  });
  const [createdGroupLink, setCreatedGroupLink] = useState<GroupInvitationLink | null>(null);
  const [groupLinkNotice, setGroupLinkNotice] = useState<string | null>(null);
  const [groupLinkExpiry, setGroupLinkExpiry] = useState<24 | 168 | 720>(168);
  const createGroupLink = useMutation({
    mutationFn: () => chatGroupsService.createInvitationLink(conversationId, groupLinkExpiry),
    onSuccess: async (link) => {
      setCreatedGroupLink(link);
      setGroupLinkNotice("Link created. Share it now; this private token is only returned once. The recipient must accept, then complete secure key handoff before joining.");
      await queryClient.invalidateQueries({ queryKey: ["group-invitation-links", conversationId] });
    },
  });
  const revokeGroupLink = useMutation({
    mutationFn: (linkId: string) => chatGroupsService.revokeInvitationLink(conversationId, linkId),
    onSuccess: async () => {
      setCreatedGroupLink(null);
      setGroupLinkNotice("Invitation link revoked.");
      await queryClient.invalidateQueries({ queryKey: ["group-invitation-links", conversationId] });
    },
  });
  const groupInviteUrl = createdGroupLink && typeof window !== "undefined"
    ? new URL(`/chats/invitations/${encodeURIComponent(createdGroupLink.token)}`, window.location.origin).toString()
    : null;
  const channelLinks = useInfiniteQuery({
    queryKey: ["channel-invitation-links", conversationId],
    queryFn: ({ pageParam }) => channelsService.listInvitationLinks(conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: isChannel && isAdmin,
    retry: false,
  });
  const [createdChannelLink, setCreatedChannelLink] = useState<ChannelInvitationLink | null>(null);
  const [channelLinkNotice, setChannelLinkNotice] = useState<string | null>(null);
  const createChannelLink = useMutation({
    mutationFn: () => channelsService.createInvitationLink(conversationId),
    onSuccess: async (link) => {
      setCreatedChannelLink(link);
      setChannelLinkNotice("Link created. Share it now; this private token is only returned once.");
      await queryClient.invalidateQueries({ queryKey: ["channel-invitation-links", conversationId] });
    },
  });
  const revokeChannelLink = useMutation({
    mutationFn: (linkId: string) => channelsService.revokeInvitationLink(conversationId, linkId),
    onSuccess: async () => {
      setCreatedChannelLink(null);
      setChannelLinkNotice("Invitation link revoked.");
      await queryClient.invalidateQueries({ queryKey: ["channel-invitation-links", conversationId] });
    },
  });
  const channelInviteUrl = createdChannelLink && typeof window !== "undefined"
    ? new URL(`/channels/invitations/${encodeURIComponent(createdChannelLink.token)}`, window.location.origin).toString()
    : null;

  if (conversationQuery.isError) return <ErrorState error={conversationQuery.error} description="Couldn't load chat info." onRetry={() => void conversationQuery.refetch()} />;
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

      {isGroup && isAdmin ? (
        <section className={settingsStyles.block} aria-labelledby="group-invitation-links-title">
          <h2 id="group-invitation-links-title" className={settingsStyles.blockHeading}>Group invitation links</h2>
          <p className={settingsStyles.muted}>Recipients must claim and accept an invitation. Secure key handoff completes before they become group members.</p>
          <div className={settingsStyles.buttonRow}>
            <label className={settingsStyles.muted}>
              Link expires
              <select aria-label="Group invitation link expiry" value={groupLinkExpiry} onChange={(event) => setGroupLinkExpiry(Number(event.target.value) as 24 | 168 | 720)}>
                <option value={24}>24 hours</option>
                <option value={168}>7 days</option>
                <option value={720}>30 days</option>
              </select>
            </label>
            <Button busy={createGroupLink.isPending} onClick={() => { setGroupLinkNotice(null); createGroupLink.mutate(); }}>Create invitation link</Button>
          </div>
          {groupLinkNotice ? <p className={settingsStyles.muted} role="status">{groupLinkNotice}</p> : null}
          {(createGroupLink.error || revokeGroupLink.error || groupLinks.error) ? <p className={settingsStyles.errorText} role="alert">{readErrorMessageForDisplay(createGroupLink.error ?? revokeGroupLink.error ?? groupLinks.error)}</p> : null}
          {groupInviteUrl ? <div className={styles.channelInviteLink}>
            <input aria-label="New group invitation link" readOnly value={groupInviteUrl} />
            <Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(groupInviteUrl).then(() => setGroupLinkNotice("Invitation link copied."), () => setGroupLinkNotice("Couldn't copy the link. Select and copy it manually.")); }}>Copy link</Button>
            <Button variant="secondary" onClick={() => { if (navigator.share) void navigator.share({ title: `Invitation to ${display.name}`, url: groupInviteUrl }).catch(() => undefined); else void navigator.clipboard.writeText(groupInviteUrl).then(() => setGroupLinkNotice("Invitation link copied."), () => setGroupLinkNotice("Couldn't copy the link. Select and copy it manually.")); }}>Share</Button>
          </div> : null}
          {groupLinks.isPending ? <p className={settingsStyles.muted}>Loading invitation links…</p> : null}
          {groupLinks.data?.pages.flatMap((page) => page.data).map((link) => (
            <div className={styles.channelInviteRow} key={link.id}>
              <span>{link.revokedAt ? "Revoked · " : "Invitation link · expires "}{new Date(link.expiresAt).toLocaleDateString()}</span>
              {!link.revokedAt ? <Button variant="secondary" busy={revokeGroupLink.isPending} onClick={() => revokeGroupLink.mutate(link.id)}>Revoke</Button> : null}
            </div>
          ))}
          {groupLinks.hasNextPage ? <Button variant="secondary" busy={groupLinks.isFetchingNextPage} onClick={() => void groupLinks.fetchNextPage()}>Load more links</Button> : null}
        </section>
      ) : null}

      {isChannel && isAdmin ? (
        <section className={settingsStyles.block} aria-labelledby="channel-invitation-links-title">
          <h2 id="channel-invitation-links-title" className={settingsStyles.blockHeading}>Channel invitation links</h2>
          <p className={settingsStyles.muted}>People who open a link must request an invitation and explicitly accept it before subscribing. Direct self-subscribe remains available.</p>
          <Button busy={createChannelLink.isPending} onClick={() => { setChannelLinkNotice(null); createChannelLink.mutate(); }}>Create invitation link</Button>
          {channelLinkNotice ? <p className={settingsStyles.muted} role="status">{channelLinkNotice}</p> : null}
          {(createChannelLink.error || revokeChannelLink.error || channelLinks.error) ? <p className={settingsStyles.errorText} role="alert">{readErrorMessageForDisplay(createChannelLink.error ?? revokeChannelLink.error ?? channelLinks.error)}</p> : null}
          {channelInviteUrl ? <div className={styles.channelInviteLink}>
            <input aria-label="New channel invitation link" readOnly value={channelInviteUrl} />
            <Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(channelInviteUrl).then(() => setChannelLinkNotice("Invitation link copied."), () => setChannelLinkNotice("Couldn't copy the link. Select and copy it manually.")); }}>Copy link</Button>
            <Button variant="secondary" onClick={() => { if (navigator.share) void navigator.share({ title: `Invitation to ${display.name}`, url: channelInviteUrl }).catch(() => undefined); else void navigator.clipboard.writeText(channelInviteUrl).then(() => setChannelLinkNotice("Invitation link copied."), () => setChannelLinkNotice("Couldn't copy the link. Select and copy it manually.")); }}>Share</Button>
          </div> : null}
          {channelLinks.isPending ? <p className={settingsStyles.muted}>Loading invitation links…</p> : null}
          {channelLinks.data?.pages.flatMap((page) => page.data).map((link) => {
            return <div className={styles.channelInviteRow} key={link.id}>
              <span>{link.revokedAt ? "Revoked · " : "Invitation link · expires "}{new Date(link.expiresAt).toLocaleDateString()}</span>
              {!link.revokedAt ? <Button variant="secondary" busy={revokeChannelLink.isPending} onClick={() => revokeChannelLink.mutate(link.id)}>Revoke</Button> : null}
            </div>;
          })}
          {channelLinks.hasNextPage ? <Button variant="secondary" busy={channelLinks.isFetchingNextPage} onClick={() => void channelLinks.fetchNextPage()}>Load more links</Button> : null}
        </section>
      ) : null}

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

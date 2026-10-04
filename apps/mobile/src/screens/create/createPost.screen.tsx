import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { CreateHeader } from "@/components/create/createHeader";
import { KeyboardSpacer } from "@/components/ui/keyboardSpacer";
import { buildLiveMonetizationInput, DEFAULT_LIVE_MONETIZATION_DRAFT, type LiveMonetizationDraft } from "@/components/create/liveMonetization.constant";
import { LiveSetupPanel, type LiveStreamCredentials } from "@/components/create/liveSetupPanel";
import { PostComposerPanel, type PostComposerDraft } from "@/components/create/postComposerPanel";
import { fillProcessingPostMediaWithLocalPreviews, usePostDraftMediaUploads } from "@/components/create/postDraftUploads.hook";
import { SoundPickerRow } from "@/components/create/soundPickerRow";
import { StoryCapturePanel } from "@/components/create/storyCapturePanel";
import { VideoReplyStage } from "@/components/clips/videoReply/videoReplyStage";
import { DEFAULT_STICKER_LAYOUT } from "@/components/clips/videoReply/videoReply.util";
import { LiveBadge } from "@/components/live/liveBadge";
import { Screen } from "@/components/ui/screen";
import { RoleGateScreen } from "@/components/roleGate/roleGateScreen";
import { useCreateMenuAccess } from "@/hooks/useCreateMenuAccess.hook";
import { openCreatorProgramOrSettings, useCreatorEntry, useCreatorStatus } from "@/hooks/useCreatorStatus.hook";
import { useTheme } from "@/theme";
import { useMyProfileQuery } from "@/components/profile/profileQueries.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { liveService } from "@/services/live.service";
import type { LocalMediaFile } from "@/services/mediaPreparation.service";
import { enqueueLocalMediaForUpload, waitForUploadedMediaId } from "@/services/mediaUploadQueue.service";
import { storiesService } from "@/services/stories.service";
import type { CommentStickerLayout, CreateMode, LiveCategory, LiveSource } from "@/types";
import { shiftMentionsAfterTrimmingStart } from "@/utils/mentions.util";

const EMPTY_POST_DRAFT: PostComposerDraft = { text: "", mentions: [], audience: "everyone", kind: "photo", isAiGenerated: false, audienceSettings: { replyPolicy: "everyone", visibility: "public", sensitiveLabels: [] } };

export function CreatePostScreen({ navigation, route }: MainScreenProps<"CreatePost">) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const videoReply = route.params?.videoReply;
  const [mode, setMode] = useState<CreateMode>(videoReply ? "clip" : (route.params?.mode ?? "post"));
  const [stickerLayout, setStickerLayout] = useState<CommentStickerLayout>(DEFAULT_STICKER_LAYOUT);
  const [postStage, setPostStage] = useState<"compose" | "preview">("compose");
  const [postDraft, setPostDraft] = useState<PostComposerDraft>(() =>
    videoReply
      ? {
          ...EMPTY_POST_DRAFT,
          kind: "clip",
          text: `@${videoReply.commenterUsername} `,
          mentions: [{ userId: videoReply.commenterUserId, username: videoReply.commenterUsername, start: 0, length: videoReply.commenterUsername.length + 1 }],
          audience: videoReply.originalAudience === "everyone" ? "everyone" : "followers",
        }
      : EMPTY_POST_DRAFT,
  );
  const postDraftUploads = usePostDraftMediaUploads(mode === "clip" ? "clip" : "post");
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(route.params?.soundId ?? null);
  const draftContainsVideo = postDraftUploads.draftMediaItems.some((item) => item.mediaType === "video");
  const hasExactlyOneClipVideo = postDraftUploads.draftMediaItems.length === 1 && postDraftUploads.draftMediaItems[0]?.mediaType === "video";
  const clipValidationHint = mode === "clip" && !hasExactlyOneClipVideo ? "A clip needs exactly one video." : null;
  useEffect(() => {
    setPostDraft((current) => {
      const kind = mode === "clip" ? "clip" : draftContainsVideo ? "video" : "photo";
      return current.kind === kind ? current : { ...current, kind };
    });
  }, [mode, draftContainsVideo]);
  const [liveTitle, setLiveTitle] = useState("");
  const [isEditingLiveTitle, setIsEditingLiveTitle] = useState(false);
  const [liveSource, setLiveSource] = useState<LiveSource>("camera");
  const [liveCategory, setLiveCategory] = useState<LiveCategory>("justChatting");
  const canSellDuringLive = Boolean(useMyProfileQuery().data?.isSeller);
  const [liveMonetization, setLiveMonetization] = useState<LiveMonetizationDraft>(DEFAULT_LIVE_MONETIZATION_DRAFT);
  const [liveCredentials, setLiveCredentials] = useState<LiveStreamCredentials | null>(null);

  const publishPost = useMutation({
    mutationFn: async () => {
      const mediaIds = await postDraftUploads.waitForAllDraftMediaIds();
      const soundIdForVideoPost = draftContainsVideo && selectedSoundId ? { soundId: selectedSoundId } : {};
      const trimmedDraft = shiftMentionsAfterTrimmingStart(postDraft.text, postDraft.mentions);
      return storiesService.publishPost({
        text: trimmedDraft.text,
        mentions: trimmedDraft.mentions,
        audience: postDraft.audience,
        mediaIds,
        kind: postDraft.kind === "clip" ? "clip" : "post",
        ...(postDraft.isAiGenerated ? { isAiGenerated: true } : {}),
        replyPolicy: postDraft.audienceSettings.replyPolicy,
        visibility: postDraft.audienceSettings.visibility,
        ...(postDraft.audienceSettings.sensitiveLabels.length > 0 ? { sensitiveLabels: postDraft.audienceSettings.sensitiveLabels } : {}),
        ...(videoReply
          ? { replyToComment: { commentId: videoReply.commentId, clipId: videoReply.clipId, commenterUserId: videoReply.commenterUserId }, stickerLayout }
          : {}),
        ...soundIdForVideoPost,
      });
    },
    onSuccess: (post) => {
      queryClient.setQueryData(["post", post.id], fillProcessingPostMediaWithLocalPreviews(post, postDraftUploads.draftMediaItems));
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      if (post.kind === "clip") queryClient.invalidateQueries({ queryKey: ["clips"] });
      navigation.replace("PostDetail", { postId: post.id });
    },
  });
  const publishStory = useMutation({
    mutationFn: async (capturedFile: LocalMediaFile) => {
      const jobId = await enqueueLocalMediaForUpload(capturedFile, "story");
      const mediaId = await waitForUploadedMediaId(jobId);
      return storiesService.publishStory({ mediaId, media: { id: mediaId, type: capturedFile.mediaType === "video" ? "video" : "image", url: capturedFile.uri } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["story-tray"] });
      navigation.goBack();
    },
  });
  const { canGoLive, isCreatorStatusLoading } = useCreatorStatus();
  const creatorEntry = useCreatorEntry();
  const createAccess = useCreateMenuAccess();
  const requestedMode = route.params?.mode;
  const isLiveModeLockedForViewer = (!canGoLive || !createAccess.isApprovedCreator) && !isCreatorStatusLoading;
  const isProductModeLockedForViewer = !createAccess.isApprovedSeller && !createAccess.isSellerStatusLoading;
  useEffect(() => {
    if (mode === "live" && isLiveModeLockedForViewer) setMode("post");
    if (mode === "product" && createAccess.isApprovedSeller) navigation.replace("ProductForm");
  }, [mode, isLiveModeLockedForViewer, createAccess.isApprovedSeller, navigation]);
  const goLive = useMutation({
    mutationFn: async () => {
      if (!canGoLive) throw new Error("Join the Creator Program to go live");
      const session = await liveService.startLiveSessionWithTitle(liveTitle || "Live on Zudomart", liveCategory, buildLiveMonetizationInput(liveMonetization));
      if (liveSource !== "external") return { session, credentials: null as LiveStreamCredentials | null };
      const issued = await liveService.issueStreamKey(session.id);
      return { session, credentials: { liveId: session.id, ...issued } satisfies LiveStreamCredentials };
    },
    onSuccess: ({ session, credentials }) => {
      if (credentials) {
        setLiveCredentials(credentials);
        return;
      }
      navigation.replace("Live", { liveId: session.id, host: true });
    },
  });
  const openLiveRoom = (liveId: string) => navigation.replace("Live", { liveId, host: true });

  const switchCreateMode = (next: CreateMode) => {
    if (videoReply) return;
    if (next === "product") {
      if (isProductModeLockedForViewer) return;
      navigation.replace("ProductForm");
      return;
    }
    if (next === "live" && isLiveModeLockedForViewer) {
      if (creatorEntry.isLoading) return;
      openCreatorProgramOrSettings(navigation, creatorEntry.route);
      return;
    }
    if ((next === "clip") !== (mode === "clip")) postDraftUploads.discardAllDraftMedia();
    setMode(next);
  };

  const closeOrStepBack = () => {
    if ((mode === "post" || mode === "clip") && postStage === "preview") setPostStage("compose");
    else if (mode === "live" && isEditingLiveTitle) setIsEditingLiveTitle(false);
    else navigation.goBack();
  };

  const canContinuePost =
    mode === "clip" ? hasExactlyOneClipVideo : postDraft.text.trim().length > 0 || postDraftUploads.draftMediaItems.length > 0;
  const isWaitingForUploads = publishPost.isPending && postDraftUploads.combinedUploadedFraction < 1;
  const publishButtonTitle = isWaitingForUploads
    ? `Uploading ${Math.round(postDraftUploads.combinedUploadedFraction * 100)}%…`
    : publishPost.isPending
      ? "Posting…"
      : "Post";

  if (requestedMode === "product" && isProductModeLockedForViewer) return <RoleGateScreen kind="seller" />;
  if (requestedMode === "live" && isLiveModeLockedForViewer) return <RoleGateScreen kind="creator" />;

  return (
    <Screen background={colors.surface} edges={["top"]}>
      <View style={styles.flex}>
        {mode === "live" ? (
          <CreateHeader
            onClose={closeOrStepBack}
            useBackArrow={isEditingLiveTitle || liveTitle.length > 0}
            afterTitle={<LiveBadge />}
            
          />
        ) : (
          <CreateHeader
            title={videoReply ? `Reply to @${videoReply.commenterUsername}'s comment` : mode === "story" ? "Story" : mode === "clip" ? "Clip" : "Post"}
            onClose={closeOrStepBack}
            actionLabel={(mode === "post" || mode === "clip") && postStage === "compose" ? "Next" : undefined}
            actionDisabled={!canContinuePost}
            onAction={() => setPostStage("preview")}
          />
        )}
        {mode === "post" || mode === "clip" ? (
          <PostComposerPanel
            stage={postStage}
            mode={mode}
            draft={postDraft}
            onChangeDraft={setPostDraft}
            draftMediaItems={postDraftUploads.draftMediaItems}
            onAddPickedMedia={postDraftUploads.addPickedMediaAndStartUploading}
            onRemoveDraftMedia={postDraftUploads.removeDraftMediaItem}
            onChangeMode={switchCreateMode}
            publishing={publishPost.isPending}
            publishButtonTitle={publishButtonTitle}
            publishErrorMessage={publishPost.error ? publishPost.error.message : null}
            validationHint={clipValidationHint}
            videoReplyStage={
              videoReply ? (
                <VideoReplyStage
                  target={videoReply}
                  draftMediaItems={postDraftUploads.draftMediaItems}
                  layout={stickerLayout}
                  audience={postDraft.audience}
                  onChangeLayout={setStickerLayout}
                />
              ) : undefined
            }
            onPublish={() => publishPost.mutate()}
            soundPicker={
              draftContainsVideo || selectedSoundId ? (
                <SoundPickerRow selectedSoundId={selectedSoundId} onChangeSelectedSoundId={setSelectedSoundId} />
              ) : null
            }
          />
        ) : mode === "story" ? (
          <StoryCapturePanel publishing={publishStory.isPending} onChangeMode={switchCreateMode} onCaptured={(m) => publishStory.mutate(m)} />
        ) : (
          <LiveSetupPanel
            title={liveTitle}
            onChangeTitle={setLiveTitle}
            isEditingTitle={isEditingLiveTitle}
            onStartEditingTitle={() => setIsEditingLiveTitle(true)}
            onFinishEditingTitle={() => setIsEditingLiveTitle(false)}
            onChangeMode={switchCreateMode}
            category={liveCategory}
            onChangeCategory={setLiveCategory}
            canSell={canSellDuringLive}
            source={liveSource}
            onChangeSource={(next) => {
              setLiveSource(next);
              if (next !== "external") setLiveCredentials(null);
            }}
            credentials={liveCredentials}
            onOpenLiveRoom={openLiveRoom}
            starting={goLive.isPending}
            onGoLive={() => goLive.mutate()}
            monetization={liveMonetization}
            onChangeMonetization={setLiveMonetization}
          />
        )}
      </View>
      <KeyboardSpacer />
    </Screen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });

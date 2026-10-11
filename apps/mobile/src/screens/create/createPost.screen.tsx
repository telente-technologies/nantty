import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { CreateHeader } from "@/components/create/createHeader";
import { KeyboardSpacer } from "@/components/ui/keyboardSpacer";
import { buildLiveMonetizationInput, DEFAULT_LIVE_MONETIZATION_DRAFT, type LiveMonetizationDraft } from "@/components/create/liveMonetization.constant";
import { LiveSetupPanel, type LiveStreamCredentials } from "@/components/create/liveSetupPanel";
import { ClipComposer, type ClipComposerSeed } from "@/components/create/clip/clipComposer";
import type { ClipLookId } from "@/components/create/clip/clipLook.constant";
import { DraftsButton, DraftsSheet } from "@/components/create/draftsSheet";
import { PostComposerPanel, type PostComposerDraft } from "@/components/create/postComposerPanel";
import { QuotedPostCard } from "@/components/feed/quotedPostCard";
import { useQuotedPostPreview } from "@/components/feed/quotedPostPreview.hook";
import { usePostDraftMediaUploads } from "@/components/create/postDraftUploads.hook";
import { usePublishPost } from "@/components/create/publishPost.hook";
import { buildPostSettingsFields, DEFAULT_POST_SETTINGS } from "@/components/create/settings/postSettings.type";
import { SoundPickerRow } from "@/components/create/soundPickerRow";
import { StoryCapturePanel } from "@/components/create/storyCapturePanel";
import { VideoReplyStage } from "@/components/clips/videoReply/videoReplyStage";
import { DEFAULT_STICKER_LAYOUT } from "@/components/clips/videoReply/videoReply.util";
import { LiveBadge } from "@/components/live/liveBadge";
import { useLiveHostStore } from "@/components/live/liveHostStore.hook";
import { LiveHostingGate } from "@/components/live/liveHostingGate";
import { canPreviewLiveHostingWithMocks, decideLiveHostingGate, detectLiveHostingSupport, type LiveHostingGateKind } from "@/services/live/liveHostingSupport.service";
import { ensureLiveCameraAndMicrophone, promptToEnableLiveMediaInSettings } from "@/services/live/liveMediaPermissions.service";
import { Screen } from "@/components/ui/screen";
import { RoleGateScreen } from "@/components/roleGate/roleGateScreen";
import { useCreateMenuAccess } from "@/hooks/useCreateMenuAccess.hook";
import { openCreatorProgramOrSettings, useCreatorEntry, useCreatorStatus } from "@/hooks/useCreatorStatus.hook";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { liveService } from "@/services/live/live.service";
import type { LocalMediaFile } from "@/services/media/mediaPreparation.service";
import { enqueueLocalMediaForUpload, waitForUploadedMediaId } from "@/services/media/mediaUploadQueue.service";
import { storiesService } from "@/services/clips/stories.service";
import { useActingProfileStore } from "@/store/actingProfile.store";
import { useComposerDraftsStore, type ComposerDraft } from "@/store/composerDrafts.store";
import { useToastStore } from "@/store/toast.store";
import type { CommentStickerLayout, CreateMode, ID, LiveCategory, LiveSource } from "@/types";
import { readLiveErrorMessage, readRunningLiveId } from "@/utils/liveStoreErrors.util";
import { shiftMentionsAfterTrimmingStart } from "@/utils/mentions.util";

const EMPTY_POST_DRAFT: PostComposerDraft = { text: "", mentions: [], audience: "everyone", kind: "photo", ...DEFAULT_POST_SETTINGS };

export function CreatePostScreen({ navigation, route }: MainScreenProps<"CreatePost">) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const videoReply = route.params?.videoReply;
  const [mode, setMode] = useState<CreateMode>(videoReply ? "clip" : (route.params?.mode ?? "post"));
  const [stickerLayout, setStickerLayout] = useState<CommentStickerLayout>(DEFAULT_STICKER_LAYOUT);
  const [postStage, setPostStage] = useState<"compose" | "settings">("compose");
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
  const hostStore = useLiveHostStore();
  const canSellDuringLive = Boolean(hostStore.storeId);
  const showToast = useToastStore((state) => state.showToast);
  const [liveMonetization, setLiveMonetization] = useState<LiveMonetizationDraft>(DEFAULT_LIVE_MONETIZATION_DRAFT);
  const [liveCredentials, setLiveCredentials] = useState<LiveStreamCredentials | null>(null);
  const actingProfileId = useActingProfileStore((s) => s.actingProfile?.id ?? null);
  const saveDraft = useComposerDraftsStore((s) => s.saveDraft);
  const closeDraftsSheet = useComposerDraftsStore((s) => s.closeDraftsSheet);
  const [clipSeed, setClipSeed] = useState<{ seed: ClipComposerSeed; key: number } | null>(null);

  const savePostDraft = () => {
    const { text, mentions, audience, kind: _kind, ...settings } = postDraft;
    const files = postDraftUploads.draftMediaItems.map((item) => ({
      uri: item.previewUri,
      mediaType: item.mediaType,
      mimeType: null,
      fileName: null,
      sizeBytes: null,
      width: item.width,
      height: item.height,
      durationSeconds: item.durationSeconds,
    }));
    saveDraft({ kind: "post", text, mentions, audience, settings, soundId: null, files, photoDurations: [], trim: null, transition: "crossfade", look: "none" });
    showToast("Draft saved");
    navigation.goBack();
  };

  const saveClipDraft = (seed: ClipComposerSeed) => {
    saveDraft({
      kind: "clip",
      text: seed.text,
      mentions: seed.mentions,
      audience: "everyone",
      settings: seed.settings,
      soundId: seed.soundId,
      files: seed.files.map((file) => ({ ...file })),
      photoDurations: seed.photoDurations,
      trim: seed.trim,
      transition: seed.transition,
      look: seed.look,
    });
    showToast("Draft saved");
    navigation.goBack();
  };

  const resumeDraft = (draft: ComposerDraft) => {
    closeDraftsSheet();
    if (draft.kind === "clip") {
      setClipSeed({
        seed: {
          text: draft.text,
          mentions: draft.mentions,
          soundId: draft.soundId,
          settings: draft.settings,
          files: draft.files.map((file) => ({ ...file })),
          photoDurations: [...draft.photoDurations],
          trim: draft.trim,
          transition: draft.transition,
          look: draft.look,
        },
        key: Date.now(),
      });
      setMode("clip");
      return;
    }
    setMode("post");
    setPostStage("compose");
    setPostDraft({ ...draft.settings, text: draft.text, mentions: draft.mentions, audience: draft.audience, kind: "photo" });
    if (draft.files.length > 0) void postDraftUploads.addPickedMediaAndStartUploading(draft.files.map((file) => ({ ...file })));
  };

  const quote = useQuotedPostPreview(mode === "post" && !videoReply && postDraft.kind !== "clip" ? postDraft.text : "");
  const publishPost = usePublishPost({
    draftMediaItems: postDraftUploads.draftMediaItems,
    combinedUploadedFraction: postDraftUploads.combinedUploadedFraction,
    waitForAllDraftMediaIds: postDraftUploads.waitForAllDraftMediaIds,
    onPublished: (post) => navigation.replace("PostDetail", { postId: post.id }),
    buildInput: (mediaIds) => {
      const trimmedDraft = shiftMentionsAfterTrimmingStart(postDraft.text, postDraft.mentions);
      return {
        text: trimmedDraft.text,
        mentions: trimmedDraft.mentions,
        audience: postDraft.audience,
        mediaIds,
        kind: postDraft.kind === "clip" ? "clip" : "post",
        ...(actingProfileId ? { asProfileId: actingProfileId } : {}),
        ...buildPostSettingsFields(postDraft),
        ...(videoReply
          ? { replyToComment: { commentId: videoReply.commentId, clipId: videoReply.clipId, commenterUserId: videoReply.commenterUserId }, stickerLayout }
          : {}),
        ...(videoReply && selectedSoundId ? { soundId: selectedSoundId } : {}),
        ...(quote.quotedPostId === undefined || postDraft.kind === "clip" || videoReply ? {} : { quotedPostId: quote.quotedPostId }),
      };
    },
  });
  const publishStory = useMutation({
    mutationFn: async ({ file, soundId, look }: { file: LocalMediaFile; soundId: ID | null; look: ClipLookId }) => {
      const jobId = await enqueueLocalMediaForUpload(file, "story");
      const mediaId = await waitForUploadedMediaId(jobId);
      return storiesService.publishStory({
        mediaId,
        ...(soundId ? { soundId } : {}),
        ...(look !== "none" ? { look } : {}),
      });
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
      const category = liveCategory === "shopping" && !hostStore.storeId ? "justChatting" : liveCategory;
      const session = await liveService.startLiveSessionWithTitle(liveTitle || "Live on Zudomart", category, buildLiveMonetizationInput(liveMonetization), hostStore.storeId);
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
    onError: (error) => {
      const runningLiveId = readRunningLiveId(error);
      if (runningLiveId) {
        navigation.replace("Live", { liveId: runningLiveId, host: true });
        return;
      }
      showToast(readLiveErrorMessage(error, error instanceof Error && error.message ? error.message : "We couldn't start your live. Try again."));
    },
  });
  const isStartingLive = useRef(false);
  const [liveHostingGate, setLiveHostingGate] = useState<LiveHostingGateKind | null>(null);
  const [hasAcceptedMockLivePreview, setHasAcceptedMockLivePreview] = useState(false);
  const startGoingLive = async () => {
    if (isStartingLive.current || goLive.isPending) return;
    const gate = decideLiveHostingGate(detectLiveHostingSupport(), liveSource, hasAcceptedMockLivePreview);
    if (gate) {
      setLiveHostingGate(gate);
      return;
    }
    isStartingLive.current = true;
    try {
      if (liveSource !== "external" && (await ensureLiveCameraAndMicrophone(liveSource === "camera")) === "denied") {
        promptToEnableLiveMediaInSettings(liveSource === "camera");
        return;
      }
      await goLive.mutateAsync().catch(() => undefined);
    } finally {
      isStartingLive.current = false;
    }
  };
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
    if ((mode === "post" || mode === "clip") && postStage === "settings") setPostStage("compose");
    else if (mode === "live" && isEditingLiveTitle) setIsEditingLiveTitle(false);
    else navigation.goBack();
  };

  const canContinuePost =
    mode === "clip" ? hasExactlyOneClipVideo : postDraft.text.trim().length > 0 || postDraftUploads.draftMediaItems.length > 0;
  if (requestedMode === "product" && isProductModeLockedForViewer) return <RoleGateScreen kind="seller" />;
  if (requestedMode === "live" && isLiveModeLockedForViewer) return <RoleGateScreen kind="creator" />;

  if (mode === "clip" && !videoReply) {
    return (
      <Screen background={colors.surface} edges={["top"]}>
        <ClipComposer
          key={clipSeed?.key ?? "fresh"}
          mode={mode}
          initialSoundId={selectedSoundId}
          initialDraft={clipSeed?.seed ?? null}
          onChangeMode={switchCreateMode}
          onClose={() => navigation.goBack()}
          onPublished={(post) => navigation.replace("PostDetail", { postId: post.id })}
          onSaveDraft={saveClipDraft}
        />
        <DraftsSheet onResume={resumeDraft} />
        <KeyboardSpacer />
      </Screen>
    );
  }

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
            afterTitle={mode === "post" && !videoReply ? <DraftsButton /> : undefined}
            actionLabel={(mode === "post" || mode === "clip") && postStage === "compose" ? "Next" : undefined}
            actionDisabled={!canContinuePost}
            onAction={() => setPostStage("settings")}
          />
        )}
        {mode === "post" || mode === "clip" ? (
          <PostComposerPanel
            stage={postStage}
            mode={mode}
            draft={postDraft}
            onChangeDraft={setPostDraft}
            quotePreview={
              quote.preview ? (
                <QuotedPostCard compact quoted={quote.preview.quoted} loading={quote.preview.status === "loading"} unavailable={quote.preview.status === "unavailable"} onRemove={quote.remove} />
              ) : null
            }
            draftMediaItems={postDraftUploads.draftMediaItems}
            onAddPickedMedia={postDraftUploads.addPickedMediaAndStartUploading}
            onRemoveDraftMedia={postDraftUploads.removeDraftMediaItem}
            onChangeMode={switchCreateMode}
            publishing={publishPost.mutation.isPending}
            publishButtonTitle={publishPost.buttonTitle}
            publishErrorMessage={publishPost.errorMessage}
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
            onPublish={() => publishPost.mutation.mutate()}
            onSaveDraft={videoReply ? undefined : savePostDraft}
            soundPicker={videoReply ? <SoundPickerRow selectedSoundId={selectedSoundId} onChangeSelectedSoundId={setSelectedSoundId} /> : null}
          />
        ) : mode === "story" ? (
          <StoryCapturePanel publishing={publishStory.isPending} onChangeMode={switchCreateMode} onCaptured={(captured) => publishStory.mutate(captured)} />
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
            starting={goLive.isPending || hostStore.isLoading}
            onGoLive={() => void startGoingLive()}
            monetization={liveMonetization}
            onChangeMonetization={setLiveMonetization}
          />
        )}
      </View>
      {mode === "live" && liveHostingGate ? (
        <LiveHostingGate
          support={liveHostingGate}
          canPreviewWithMocks={canPreviewLiveHostingWithMocks()}
          onPreviewWithMocks={() => {
            setHasAcceptedMockLivePreview(true);
            setLiveHostingGate(null);
          }}
          onClose={() => setLiveHostingGate(null)}
        />
      ) : null}
      <DraftsSheet onResume={resumeDraft} />
      <KeyboardSpacer />
    </Screen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });

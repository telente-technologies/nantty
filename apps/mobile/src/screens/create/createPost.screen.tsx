import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";

import { CreateHeader } from "@/components/create/createHeader";
import { LiveSetupPanel } from "@/components/create/liveSetupPanel";
import { PostComposerPanel } from "@/components/create/postComposerPanel";
import { StoryCapturePanel } from "@/components/create/storyCapturePanel";
import { LiveBadge } from "@/components/live/liveBadge";
import { Screen } from "@/components/ui/screen";
import { openCreatorProgramOrSettings, useCreatorStatus } from "@/hooks/useCreatorStatus.hook";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { liveService } from "@/services/live.service";
import { storiesService } from "@/services/stories.service";
import type { CreateMode, Media, NewPostInput } from "@/types";

const EMPTY_POST_DRAFT: NewPostInput = { text: "", media: [], audience: "everyone" };

export function CreatePostScreen({ navigation, route }: MainScreenProps<"CreatePost">) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<CreateMode>(route.params?.mode ?? "post");
  const [postStage, setPostStage] = useState<"compose" | "preview">("compose");
  const [postDraft, setPostDraft] = useState<NewPostInput>(EMPTY_POST_DRAFT);
  const [liveTitle, setLiveTitle] = useState("");
  const [isEditingLiveTitle, setIsEditingLiveTitle] = useState(false);

  const publishPost = useMutation({
    mutationFn: () => storiesService.publishPost(postDraft),
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      navigation.replace("PostDetail", { postId: post.id });
    },
  });
  const publishStory = useMutation({
    mutationFn: (media: Media) => storiesService.publishStory({ media }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["story-tray"] });
      navigation.goBack();
    },
  });
  const { canGoLive, isCreatorStatusLoading } = useCreatorStatus();
  const isLiveModeLockedForViewer = !canGoLive && !isCreatorStatusLoading;
  useEffect(() => {
    if (mode !== "live" || !isLiveModeLockedForViewer) return;
    setMode("post");
    openCreatorProgramOrSettings(navigation);
  }, [mode, isLiveModeLockedForViewer, navigation]);
  const goLive = useMutation({
    mutationFn: async () => {
      if (!canGoLive) throw new Error("Join the Creator Program to go live");
      return liveService.startLiveSessionWithTitle(liveTitle || "Live on Zudomart");
    },
    onSuccess: (session) => navigation.replace("Live", { liveId: session.id, host: true }),
  });

  const switchCreateMode = (next: CreateMode) => {
    if (next === "product") {
      navigation.replace("ProductForm");
      return;
    }
    if (next === "live" && isLiveModeLockedForViewer) {
      openCreatorProgramOrSettings(navigation);
      return;
    }
    setMode(next);
  };

  const closeOrStepBack = () => {
    if (mode === "post" && postStage === "preview") setPostStage("compose");
    else if (mode === "live" && isEditingLiveTitle) setIsEditingLiveTitle(false);
    else navigation.goBack();
  };

  const canContinuePost = postDraft.text.trim().length > 0 || postDraft.media.length > 0;

  return (
    <Screen background={colors.white} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {mode === "live" ? (
          <CreateHeader
            onClose={closeOrStepBack}
            useBackArrow={isEditingLiveTitle || liveTitle.length > 0}
            afterTitle={<LiveBadge />}
            
          />
        ) : (
          <CreateHeader
            title={mode === "story" ? "Story" : "Post"}
            onClose={closeOrStepBack}
            actionLabel={mode === "post" && postStage === "compose" ? "Next" : undefined}
            actionDisabled={!canContinuePost}
            onAction={() => setPostStage("preview")}
          />
        )}
        {mode === "post" ? (
          <PostComposerPanel
            stage={postStage}
            draft={postDraft}
            onChangeDraft={setPostDraft}
            onChangeMode={switchCreateMode}
            publishing={publishPost.isPending}
            onPublish={() => publishPost.mutate()}
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
            starting={goLive.isPending}
            onGoLive={() => goLive.mutate()}
          />
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });

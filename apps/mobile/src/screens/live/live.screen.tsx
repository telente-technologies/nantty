import { useIsFocused } from "@react-navigation/native";
import { useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useShareToChat } from "@/components/chatSafety/shareToChat.hook";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DotsThreeVertical24Icon, MagnifyingGlass24Icon, PaperPlaneTilt24Icon } from "@/components/icons";
import { JoinLiveCard } from "@/components/live/joinLiveCard";
import { TipSheet } from "@/components/coins/tipSheet";
import { LikeBurst } from "@/components/clips/likeBurst";
import { LiveGiftOverlay } from "@/components/live/gifts/liveGiftOverlay";
import { LiveGiftPickerSheet } from "@/components/live/gifts/liveGiftPickerSheet";
import { useLiveGiftComments } from "@/components/live/gifts/liveGiftComments.hook";
import { LiveCommentBar } from "@/components/live/liveCommentBar";
import { KeyboardSpacer } from "@/components/ui/keyboardSpacer";
import { LiveCommentsFeed } from "@/components/live/liveCommentsFeed";
import { LiveHeader } from "@/components/live/liveHeader";
import { LiveProductsSheet } from "@/components/live/liveProductsSheet";
import { LivePinProductsSheet } from "@/components/live/livePinProductsSheet";
import { useLiveEngagementPoints } from "@/components/live/points/liveZudoPoints.hook";
import { LiveReactionRail } from "@/components/live/liveReactionRail";
import { useLiveSessionWithActions } from "@/components/live/liveSession.hook";
import { ShareLiveSheet } from "@/components/live/shareLiveSheet";
import { doesLiveStageShowVideo, LiveVideoStage } from "@/components/live/liveVideoStage";
import { useLiveStageWithActions } from "@/components/live/guests/liveStage.hook";
import { LiveStageLayer } from "@/components/live/guests/liveStageLayer";
import { ContentOptionsSheet } from "@/components/moderation/contentOptionsSheet";
import { openCreatorProgramOrSettings, useCreatorEntry, useCreatorStatus } from "@/hooks/useCreatorStatus.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { liveService } from "@/services/live.service";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { requireAuthAfterClosingModal, requireAuthThen } from "@/utils/requireAuth.util";
import { makeThemedStyles, useTheme } from "@/theme";

const DOUBLE_TAP_WINDOW_MS = 280;

export function LiveScreen({ navigation, route }: MainScreenProps<"Live">) {
  const { liveId, host: isHost = false } = route.params;
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const isScreenFocused = useIsFocused();
  const [cameraPermission] = useCameraPermissions();
  const [hasJoined, setHasJoined] = useState(isHost);
  const [reactionsExpanded, setReactionsExpanded] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const { openSendInChat, sendInChatElement } = useShareToChat();
  const [showProducts, setShowProducts] = useState(false);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [showTipSheet, setShowTipSheet] = useState(false);
  const [showPinProducts, setShowPinProducts] = useState(false);
  const [showViewerLiveOptions, setShowViewerLiveOptions] = useState(false);
  const live = useLiveSessionWithActions(liveId, hasJoined);
  const livePoints = useLiveEngagementPoints(liveId, hasJoined && !isHost);
  const liveStage = useLiveStageWithActions(liveId, hasJoined);
  const giftComments = useLiveGiftComments(liveId, live.session.data ? [live.session.data.host] : []);
  const { canGoLive, isApprovedCreator, isCreatorStatusLoading } = useCreatorStatus();
  const creatorEntry = useCreatorEntry();
  const session = live.session.data;
  const isHostBlockedFromGoingLive = isHost && !isCreatorStatusLoading && !canGoLive;
  const viewerCanSendGifts = !isHost && (session?.giftsEnabled ?? session?.hostIsCreator ?? false);
  const hostCanPinAffiliatedProducts = isHost && isApprovedCreator;
  const [likeBurstKey, setLikeBurstKey] = useState(0);
  const lastStageTapAt = useRef(0);
  const likeLiveByDoubleTap = () => {
    const now = Date.now();
    if (now - lastStageTapAt.current < DOUBLE_TAP_WINDOW_MS) {
      lastStageTapAt.current = 0;
      setLikeBurstKey((key) => key + 1);
      live.sendReaction("❤️");
      livePoints.awardLikePoints();
      return;
    }
    lastStageTapAt.current = now;
  };

  useEffect(() => {
    if (!isHostBlockedFromGoingLive) return;
    navigation.goBack();
    openCreatorProgramOrSettings(navigation, creatorEntry.route);
  }, [isHostBlockedFromGoingLive, navigation, creatorEntry.route]);

  useEffect(() => {
    if (session?.status === "ended") navigation.replace("LiveEnded", { liveId });
  }, [session?.status, navigation, liveId]);

  useEffect(() => {
    if (!hasJoined || isHost) return;
    liveService.joinLiveSession(liveId).catch(() => undefined);
    return () => {
      liveService.leaveLiveSession(liveId).catch(() => undefined);
    };
  }, [hasJoined, isHost, liveId]);

  const endLiveAsHost = () =>
    liveService
      .endLiveSession(liveId)
      .then(() => navigation.replace("LiveEnded", { liveId }))
      .catch(() => undefined);

  const openLiveOptions = () => {
    if (isHost) {
      showAlertWithButtons("End live?", "Viewers will be told the live has ended.", [
        { text: "Cancel", style: "cancel" },
        { text: "End live", style: "destructive", onPress: endLiveAsHost },
      ]);
    } else {
      setShowViewerLiveOptions(true);
    }
  };

  const viewerLiveOptionsSheet = (
    <>
    {sendInChatElement}
    <ContentOptionsSheet
      target={
        showViewerLiveOptions && session
          ? { targetType: "live", targetId: liveId, authorId: session.host.id, shareUrl: `https://zudomart.com/lives/${liveId}` }
          : null
      }
      onClose={() => setShowViewerLiveOptions(false)}
      additionalActions={[
        { label: "Send in chat", icon: <PaperPlaneTilt24Icon />, onPress: () => openSendInChat({ kind: "live", id: liveId }) },
        { label: "Share with people", icon: <PaperPlaneTilt24Icon />, onPress: () => requireAuthAfterClosingModal(() => undefined, () => setShowShare(true), "share with people") },
      ]}
    />
    </>
  );

  if (!session) return <View style={[styles.root, { paddingTop: insets.top }]} />;

  if (!hasJoined) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 50 }]}>
        <View style={styles.joinTop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Search" hitSlop={10} onPress={() => navigation.navigate("Search")} style={styles.topButton}>
            <MagnifyingGlass24Icon size={20} color={colors.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Live options" hitSlop={10} onPress={() => setShowViewerLiveOptions(true)} style={styles.topButton}>
            <DotsThreeVertical24Icon size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.flex} />
        <JoinLiveCard session={session} showHost={session.isFollowingHost} onWatch={() => setHasJoined(true)} onDismiss={() => navigation.goBack()} />
        <ShareLiveSheet liveId={liveId} visible={showShare} onClose={() => setShowShare(false)} />
        {viewerLiveOptionsSheet}
      </View>
    );
  }

  const showsTitle = isHost || live.isFollowingHost;
  const isHostCameraAllowed = !!cameraPermission?.granted;
  const isShownOverVideo = liveStage.isMultiGuestLayout || doesLiveStageShowVideo(session, isHost, isHostCameraAllowed);
  const liveHasProducts = session.products.length > 0;
  const hostCanPinProductsToThisLive = hostCanPinAffiliatedProducts && (liveHasProducts || session.category === "shopping");
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {liveStage.isMultiGuestLayout ? null : (
        <LiveVideoStage session={session} isHost={isHost} isHostCameraAllowed={isHostCameraAllowed} isPlaybackAllowed={isScreenFocused} />
      )}
      {isHost ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Double tap to like this live"
          onPress={likeLiveByDoubleTap}
          style={StyleSheet.absoluteFill}
        />
      )}
      {isHost ? null : <LikeBurst burstKey={likeBurstKey} />}
      <LiveStageLayer
        liveId={liveId}
        session={session}
        controller={liveStage}
        canViewerSendGifts={viewerCanSendGifts}
        isCameraPermissionGranted={isHostCameraAllowed}
        isPlaybackAllowed={isScreenFocused}
      />
      <LiveHeader
        isShownOverVideo={isShownOverVideo}
        session={session}
        showTitle={showsTitle}
        isHost={isHost}
        isFollowingHost={live.isFollowingHost}
        onBack={() => navigation.goBack()}
        onToggleFollow={() => {
          if (!live.isFollowingHost) livePoints.awardFollowPoints();
          live.followHost();
        }}
        onMore={openLiveOptions}
      />
      <View style={styles.flex} />
      <View style={styles.bottomRow}>
        <LiveCommentsFeed comments={[...(live.comments.data?.data ?? []), ...giftComments]} isShownOverVideo={isShownOverVideo} />
        <LiveReactionRail expanded={reactionsExpanded} onReact={live.sendReaction} isShownOverVideo={isShownOverVideo} />
      </View>
      <View style={isShownOverVideo ? null : styles.commentBarArea}>
        <LiveCommentBar
          isShownOverVideo={isShownOverVideo}
          isSending={live.sendComment.isPending}
          onSend={(text) => requireAuthThen(() => live.sendComment.mutate(text), undefined, "comment on lives")}
          onToggleReactions={() => setReactionsExpanded((e) => !e)}
          onPressProducts={
            hostCanPinProductsToThisLive ? () => setShowPinProducts(true) : liveHasProducts ? () => setShowProducts(true) : undefined
          }
          onPressGift={viewerCanSendGifts ? () => requireAuthThen(() => setShowGiftPicker(true), undefined, "send gifts") : undefined}
          onPressTip={viewerCanSendGifts ? () => setShowTipSheet(true) : undefined}
        />
        <KeyboardSpacer />
      </View>
      {showTipSheet ? (
        <TipSheet target={{ targetType: "live", targetId: liveId, creatorName: session.host.name }} onClose={() => setShowTipSheet(false)} />
      ) : null}
      <LiveGiftOverlay liveId={liveId} streamer={session.host} isHost={isHost} topOffset={insets.top + 60} />
      {viewerCanSendGifts ? (
        <LiveGiftPickerSheet liveId={liveId} recipientUserId={session.host.id} visible={showGiftPicker} onClose={() => setShowGiftPicker(false)} />
      ) : null}
      {hostCanPinProductsToThisLive ? (
        <LivePinProductsSheet
          visible={showPinProducts}
          liveId={liveId}
          pinnedProductId={session.pinnedProductId ?? null}
          onClose={() => setShowPinProducts(false)}
        />
      ) : null}
      <ShareLiveSheet liveId={liveId} visible={showShare} onClose={() => setShowShare(false)} onShared={livePoints.awardSharePoints} />
      {isHost ? null : viewerLiveOptionsSheet}
      {liveHasProducts ? (
      <LiveProductsSheet
        visible={showProducts}
        products={session.products}
        onClose={() => setShowProducts(false)}
        onOpenProduct={(productId) => {
          setShowProducts(false);
          navigation.navigate("ProductDetail", { productId });
        }}
      />
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  joinTop: { height: 48, paddingHorizontal: 12, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8 },
  topButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: scheme === "dark" ? "#2C2C2C" : "#F0F2FA" },
  commentBarArea: { backgroundColor: colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  bottomRow: { paddingHorizontal: 12, paddingBottom: 8, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
}));

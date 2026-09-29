import { useIsFocused } from "@react-navigation/native";
import { useCameraPermissions } from "expo-camera";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DotsThreeVertical24Icon, MagnifyingGlass24Icon, PaperPlaneTilt24Icon } from "@/components/icons";
import { JoinLiveCard } from "@/components/live/joinLiveCard";
import { TipSheet } from "@/components/coins/tipSheet";
import { LiveGiftBurst } from "@/components/live/liveGiftBurst";
import { LiveGiftPickerSheet } from "@/components/live/liveGiftPickerSheet";
import { useLiveGifting } from "@/components/live/liveGifting.hook";
import { LiveCommentBar } from "@/components/live/liveCommentBar";
import { LiveCommentsFeed } from "@/components/live/liveCommentsFeed";
import { LiveHeader } from "@/components/live/liveHeader";
import { LiveProductsSheet } from "@/components/live/liveProductsSheet";
import { LivePinProductsSheet } from "@/components/live/livePinProductsSheet";
import { LiveReactionRail } from "@/components/live/liveReactionRail";
import { useLiveSessionWithActions } from "@/components/live/liveSession.hook";
import { ShareLiveSheet } from "@/components/live/shareLiveSheet";
import { doesLiveStageShowVideo, LiveVideoStage } from "@/components/live/liveVideoStage";
import { ContentOptionsSheet } from "@/components/moderation/contentOptionsSheet";
import { colors } from "@/constants/colors.constant";
import { openCreatorProgramOrSettings, useCreatorStatus } from "@/hooks/useCreatorStatus.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { liveService } from "@/services/live.service";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

export function LiveScreen({ navigation, route }: MainScreenProps<"Live">) {
  const { liveId, host: isHost = false } = route.params;
  const insets = useSafeAreaInsets();
  const isScreenFocused = useIsFocused();
  const [cameraPermission] = useCameraPermissions();
  const [hasJoined, setHasJoined] = useState(isHost);
  const [reactionsExpanded, setReactionsExpanded] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [showTipSheet, setShowTipSheet] = useState(false);
  const [showPinProducts, setShowPinProducts] = useState(false);
  const [showViewerLiveOptions, setShowViewerLiveOptions] = useState(false);
  const live = useLiveSessionWithActions(liveId, hasJoined);
  const gifting = useLiveGifting(liveId, showGiftPicker);
  const { canGoLive, isApprovedCreator, isCreatorStatusLoading } = useCreatorStatus();
  const session = live.session.data;
  const isHostBlockedFromGoingLive = isHost && !isCreatorStatusLoading && !canGoLive;
  const viewerCanSendGifts = !isHost && (session?.giftsEnabled ?? session?.hostIsCreator ?? false);
  const hostCanPinAffiliatedProducts = isHost && isApprovedCreator;

  useEffect(() => {
    if (!isHostBlockedFromGoingLive) return;
    navigation.goBack();
    openCreatorProgramOrSettings(navigation);
  }, [isHostBlockedFromGoingLive, navigation]);

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
    <ContentOptionsSheet
      target={
        showViewerLiveOptions && session
          ? { targetType: "live", targetId: liveId, authorId: session.host.id, shareUrl: `https://zudomart.com/lives/${liveId}` }
          : null
      }
      onClose={() => setShowViewerLiveOptions(false)}
      additionalActions={[{ label: "Share with people", icon: <PaperPlaneTilt24Icon />, onPress: () => setShowShare(true) }]}
    />
  );

  if (!session) return <View style={[styles.root, { paddingTop: insets.top }]} />;

  if (!hasJoined) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 50 }]}>
        <View style={styles.joinTop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Search" hitSlop={10} onPress={() => navigation.navigate("Search")}>
            <MagnifyingGlass24Icon />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Live options" hitSlop={10} onPress={() => setShowViewerLiveOptions(true)}>
            <DotsThreeVertical24Icon />
          </Pressable>
        </View>
        <View style={styles.flex} />
        <JoinLiveCard session={session} showHost={session.isFollowingHost} onWatch={() => setHasJoined(true)} />
        <ShareLiveSheet liveId={liveId} visible={showShare} onClose={() => setShowShare(false)} />
        {viewerLiveOptionsSheet}
      </View>
    );
  }

  const showsTitle = isHost || live.isFollowingHost;
  const isHostCameraAllowed = !!cameraPermission?.granted;
  const isShownOverVideo = doesLiveStageShowVideo(session, isHost, isHostCameraAllowed);
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LiveVideoStage session={session} isHost={isHost} isHostCameraAllowed={isHostCameraAllowed} isPlaybackAllowed={isScreenFocused} />
      <LiveHeader
        isShownOverVideo={isShownOverVideo}
        session={session}
        showTitle={showsTitle}
        isHost={isHost}
        isFollowingHost={live.isFollowingHost}
        onBack={() => navigation.goBack()}
        onToggleFollow={live.followHost}
        onMore={openLiveOptions}
      />
      <View style={styles.flex} />
      <View style={styles.bottomRow}>
        <LiveCommentsFeed comments={[...(live.comments.data?.data ?? []), ...gifting.sentGiftComments]} isShownOverVideo={isShownOverVideo} />
        <LiveReactionRail expanded={reactionsExpanded} onReact={live.sendReaction} />
      </View>
      <View style={[styles.commentBarArea, { paddingBottom: insets.bottom }]}>
        <LiveCommentBar
          onSend={(text) => live.sendComment.mutate(text)}
          onToggleReactions={() => setReactionsExpanded((e) => !e)}
          onPressProducts={
            hostCanPinAffiliatedProducts ? () => setShowPinProducts(true) : session.products.length > 0 ? () => setShowProducts(true) : undefined
          }
          onPressGift={viewerCanSendGifts ? () => setShowGiftPicker(true) : undefined}
          onPressTip={viewerCanSendGifts ? () => setShowTipSheet(true) : undefined}
        />
      </View>
      {showTipSheet ? (
        <TipSheet target={{ targetType: "live", targetId: liveId, creatorName: session.host.name }} onClose={() => setShowTipSheet(false)} />
      ) : null}
      <LiveGiftBurst burst={gifting.latestGiftBurst} />
      {viewerCanSendGifts ? (
        <LiveGiftPickerSheet
          visible={showGiftPicker}
          gifts={gifting.giftCatalog.data ?? []}
          isLoadingGifts={gifting.giftCatalog.isPending && showGiftPicker}
          isSendingGift={gifting.sendGift.isPending}
          errorMessage={gifting.giftSendingErrorMessage}
          hasNotEnoughCoins={gifting.hasNotEnoughCoinsForGift}
          onChangeSelection={gifting.forgetPendingGiftAttempt}
          onSendGift={(gift, quantity) =>
            gifting.sendGift.mutate({ gift, quantity }, { onSuccess: () => setShowGiftPicker(false) })
          }
          onClose={() => setShowGiftPicker(false)}
        />
      ) : null}
      {hostCanPinAffiliatedProducts ? (
        <LivePinProductsSheet
          visible={showPinProducts}
          liveId={liveId}
          pinnedProductId={session.pinnedProductId ?? null}
          onClose={() => setShowPinProducts(false)}
        />
      ) : null}
      <ShareLiveSheet liveId={liveId} visible={showShare} onClose={() => setShowShare(false)} />
      {isHost ? null : viewerLiveOptionsSheet}
      <LiveProductsSheet
        visible={showProducts}
        products={session.products}
        onClose={() => setShowProducts(false)}
        onOpenProduct={(productId) => {
          setShowProducts(false);
          navigation.navigate("ProductDetail", { productId });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  joinTop: { height: 40, paddingHorizontal: 16, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 12 },
  commentBarArea: { backgroundColor: colors.white },
  bottomRow: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
});

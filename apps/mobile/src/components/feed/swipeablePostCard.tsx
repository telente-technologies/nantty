import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { PanResponder, StyleSheet, View, useWindowDimensions, type AccessibilityActionEvent } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { LikeActionIcon, ReplyActionIcon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import { requireAuthThen } from "@/utils/requireAuth.util";

import { PostCard, type PostCardProps } from "./postCard";
import { usePostActionTint } from "./postActionButton";

const ACTIVATION_OFFSET_X = 18;
const FAIL_OFFSET_Y = 12;
const COMMIT_WIDTH_RATIO = 0.28;
const COMMIT_VELOCITY = 0.8;
const MINIMUM_DISTANCE_FOR_VELOCITY_COMMIT = 48;
const MAXIMUM_DRAG_RATIO = 0.45;
const HINT_ICON_SIZE = 26;
const SPRING_BACK = { damping: 18, stiffness: 220, mass: 0.6 } as const;

export interface SwipeablePostCardProps extends PostCardProps {
  readonly onOpenComments: () => void;
  readonly onSwipeActiveChange?: (isActive: boolean) => void;
}

export function SwipeablePostCard({ onOpenComments, onSwipeActiveChange, ...cardProps }: SwipeablePostCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const likeTint = usePostActionTint("like");
  const replyTint = usePostActionTint("reply");
  const isReducedMotionPreferred = useReducedMotionPreference();
  const { width: windowWidth } = useWindowDimensions();
  const [cardWidth, setCardWidth] = useState(windowWidth);
  const [likePopKey, setLikePopKey] = useState(0);
  const dragX = useSharedValue(0);
  const touchStartedOnCarousel = useRef(false);
  const hasCrossedThreshold = useRef(false);
  const commitDistance = cardWidth * COMMIT_WIDTH_RATIO;

  const likeFromSwipe = () => {
    if (cardProps.post.liked || !cardProps.onToggleLike) return;
    requireAuthThen(
      () => {
        setLikePopKey((key) => key + 1);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        cardProps.onToggleLike?.();
      },
      undefined,
      "like posts",
    );
  };
  const openCommentsFromSwipe = () => {
    Haptics.selectionAsync().catch(() => undefined);
    onOpenComments();
  };

  const latest = useRef({ likeFromSwipe, openCommentsFromSwipe, commitDistance, cardWidth, isReducedMotionPreferred, onSwipeActiveChange, isLiked: cardProps.post.liked });
  useEffect(() => {
    latest.current = { likeFromSwipe, openCommentsFromSwipe, commitDistance, cardWidth, isReducedMotionPreferred, onSwipeActiveChange, isLiked: cardProps.post.liked };
  });

  const settle = () => {
    dragX.value = latest.current.isReducedMotionPreferred ? withTiming(0, { duration: 180 }) : withSpring(0, SPRING_BACK);
    hasCrossedThreshold.current = false;
    latest.current.onSwipeActiveChange?.(false);
  };

  const [panResponder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        !touchStartedOnCarousel.current &&
        Math.abs(gesture.dx) > ACTIVATION_OFFSET_X &&
        Math.abs(gesture.dy) < FAIL_OFFSET_Y &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
      onPanResponderGrant: () => latest.current.onSwipeActiveChange?.(true),
      onPanResponderMove: (_, gesture) => {
        const { cardWidth: width, commitDistance: distance, isLiked } = latest.current;
        const limit = width * MAXIMUM_DRAG_RATIO;
        const offset = gesture.dx - Math.sign(gesture.dx) * ACTIVATION_OFFSET_X;
        dragX.value = Math.max(-limit, Math.min(limit, offset));
        const crossed = Math.abs(offset) >= distance && !(offset > 0 && isLiked);
        if (crossed && !hasCrossedThreshold.current) Haptics.selectionAsync().catch(() => undefined);
        hasCrossedThreshold.current = crossed;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gesture) => {
        const { commitDistance: distance } = latest.current;
        const offset = gesture.dx - Math.sign(gesture.dx) * ACTIVATION_OFFSET_X;
        const flung = Math.abs(gesture.vx) > COMMIT_VELOCITY && Math.abs(offset) > MINIMUM_DISTANCE_FOR_VELOCITY_COMMIT;
        const committed = Math.abs(offset) >= distance || flung;
        settle();
        touchStartedOnCarousel.current = false;
        if (!committed) return;
        if (offset > 0) latest.current.likeFromSwipe();
        else latest.current.openCommentsFromSwipe();
      },
      onPanResponderTerminate: () => {
        settle();
        touchStartedOnCarousel.current = false;
      },
    }),
  );

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: isReducedMotionPreferred ? 0 : dragX.value }] }), [isReducedMotionPreferred]);
  const likeHintStyle = useAnimatedStyle(() => {
    const progress = interpolate(dragX.value, [0, commitDistance], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: progress,
      transform: isReducedMotionPreferred ? [] : [{ translateX: Math.max(0, dragX.value / 2 - HINT_ICON_SIZE) }, { scale: 0.6 + progress * 0.4 }],
    };
  }, [commitDistance, isReducedMotionPreferred]);
  const replyHintStyle = useAnimatedStyle(() => {
    const progress = interpolate(-dragX.value, [0, commitDistance], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: progress,
      transform: isReducedMotionPreferred ? [] : [{ translateX: Math.min(0, dragX.value / 2 + HINT_ICON_SIZE) }, { scale: 0.6 + progress * 0.4 }],
    };
  }, [commitDistance, isReducedMotionPreferred]);

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "like") likeFromSwipe();
    else if (event.nativeEvent.actionName === "openComments") onOpenComments();
  };

  const hintLayer = (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.hints, isReducedMotionPreferred ? styles.hintsAbove : null]}>
      <Animated.View style={[styles.hint, isReducedMotionPreferred ? styles.hintPill : null, likeHintStyle]}>
        <LikeActionIcon size={HINT_ICON_SIZE} color={likeTint} filled />
        <Text size={12} weight={600} lineHeight={16} color={likeTint}>
          {cardProps.post.liked ? "Liked" : "Like"}
        </Text>
      </Animated.View>
      <Animated.View style={[styles.hint, isReducedMotionPreferred ? styles.hintPill : null, replyHintStyle]}>
        <ReplyActionIcon size={HINT_ICON_SIZE} color={replyTint} />
        <Text size={12} weight={600} lineHeight={16} color={replyTint}>
          Reply
        </Text>
      </Animated.View>
    </View>
  );

  return (
    <View
      style={[styles.root, { backgroundColor: colors.sunken }]}
      onLayout={(event) => setCardWidth(event.nativeEvent.layout.width || windowWidth)}
      onTouchEnd={() => (touchStartedOnCarousel.current = false)}
      onTouchCancel={() => (touchStartedOnCarousel.current = false)}
      {...(cardProps.post.sponsored ? {} : panResponder.panHandlers)}
    >
      {isReducedMotionPreferred ? null : hintLayer}
      <Animated.View style={cardStyle}>
        <PostCard
          {...cardProps}
          likePopKey={likePopKey}
          onMediaPagerTouchStart={() => {
            if (cardProps.post.media.length > 1) touchStartedOnCarousel.current = true;
          }}
          accessibilityActions={[
            { name: "like", label: cardProps.post.liked ? "Already liked" : "Like post" },
            { name: "openComments", label: "Open comments" },
          ]}
          onAccessibilityAction={handleAccessibilityAction}
        />
      </Animated.View>
      {isReducedMotionPreferred ? hintLayer : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    root: { overflow: "hidden" },
    hints: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24 },
    hintsAbove: { zIndex: 2 },
    hint: { alignItems: "center", gap: 4 },
    hintPill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.elevated },
  }),
);

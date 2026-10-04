import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { Share } from "react-native";

import { ArrowUpRight24Icon, EyeClosed20Icon, Share24Icon, Warning20Icon } from "@/components/icons";
import { ActionSheet } from "@/components/ui/actionSheet";
import { feedFeedbackService, hidePostFromAllCachedFeeds, type FeedFeedbackType } from "@/services/feedFeedback.service";
import type { ReportTargetType } from "@/services/reports.service";
import { useAuthStore } from "@/store/auth.store";
import type { ID } from "@/types";
import { requireAuthAfterClosingModal } from "@/utils/requireAuth.util";

import { ReportSheet, type ReportTarget } from "./reportSheet";

export interface ContentOptionsTarget {
  readonly targetType: Extract<ReportTargetType, "post" | "clip" | "live" | "user" | "product">;
  readonly targetId: ID;
  readonly authorId?: ID | null;
  readonly shareUrl?: string;
}

export interface ContentOptionsSheetProps {
  readonly target: ContentOptionsTarget | null;
  readonly onClose: () => void;
  readonly onContentHidden?: (targetId: ID) => void;
  readonly additionalActions?: readonly { readonly label: string; readonly icon: ReactNode; readonly onPress: () => void }[];
  readonly onReport?: () => void;
}

type NavigatorWithRouteNames = {
  getState: () => { routeNames?: readonly string[] } | undefined;
  navigate: (name: string, params?: object) => void;
};

export const PROMOTE_POST_ROUTE_NAME = "PromotePost";

export function openPromotePostScreenIfAvailable(navigation: NavigatorWithRouteNames, postId: ID) {
  let current: NavigatorWithRouteNames | undefined = navigation;
  const routeNames = current.getState()?.routeNames ?? [];
  if (!routeNames.includes(PROMOTE_POST_ROUTE_NAME)) {
    const parent = (navigation as unknown as { getParent?: () => NavigatorWithRouteNames | undefined }).getParent?.();
    current = parent?.getState()?.routeNames?.includes(PROMOTE_POST_ROUTE_NAME) ? parent : undefined;
  }
  if (!current) return false;
  current.navigate(PROMOTE_POST_ROUTE_NAME, { postId });
  return true;
}

export function ContentOptionsSheet({ target, onClose, onContentHidden, additionalActions = [], onReport }: ContentOptionsSheetProps) {
  const navigation = useNavigation() as unknown as NavigatorWithRouteNames;
  const queryClient = useQueryClient();
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const isOwnContent = !!target?.authorId && target.authorId === signedInUserId;
  const canGiveFeedFeedback = !!target && !isOwnContent && (target.targetType === "post" || target.targetType === "clip");
  const canPromote = !!target && isOwnContent && target.targetType === "post";
  const canClaimCopyright = !!target && (target.targetType === "post" || target.targetType === "clip" || target.targetType === "live");

  const hideContentAndSendFeedback = (type: FeedFeedbackType) => {
    if (!target) return;
    const restoreFeeds = hidePostFromAllCachedFeeds(queryClient, target.targetId);
    onContentHidden?.(target.targetId);
    feedFeedbackService.sendFeedFeedbackForPost(target.targetId, type).catch(restoreFeeds);
    onClose();
  };

  const openReportSheetForTarget = (initialReason?: ReportTarget["initialReason"]) => {
    if (!target) return;
    const nextReportTarget: ReportTarget = { targetType: target.targetType, targetId: target.targetId, ...(initialReason ? { initialReason } : {}) };
    requireAuthAfterClosingModal(onClose, onReport ?? (() => setReportTarget(nextReportTarget)), "report");
    onClose();
  };

  const shareLinkToContent = () => {
    if (!target?.shareUrl) return;
    onClose();
    Share.share({ message: target.shareUrl }).catch(() => undefined);
  };

  const promoteOwnPost = () => {
    if (!target) return;
    onClose();
    openPromotePostScreenIfAvailable(navigation, target.targetId);
  };

  const noun = target?.targetType === "clip" ? "clip" : "post";

  return (
    <>
      <ActionSheet
        visible={!!target}
        onClose={onClose}
        closeBeforeSelect={false}
        options={[
          ...additionalActions.map((action) => ({ label: action.label, icon: action.icon, onPress: () => { onClose(); action.onPress(); } })),
          ...(canPromote ? [{ label: "Promote post", icon: <ArrowUpRight24Icon />, onPress: promoteOwnPost }] : []),
          ...(canGiveFeedFeedback
            ? [
                { label: `Hide ${noun}`, icon: <EyeClosed20Icon />, onPress: () => requireAuthAfterClosingModal(onClose, () => hideContentAndSendFeedback("hide"), "tune your feed") },
                { label: "Not interested", icon: <EyeClosed20Icon />, onPress: () => requireAuthAfterClosingModal(onClose, () => hideContentAndSendFeedback("not_interested"), "tune your feed") },
              ]
            : []),
          ...(target?.shareUrl ? [{ label: "Copy or share link", icon: <Share24Icon />, onPress: shareLinkToContent }] : []),
          ...(!isOwnContent ? [{ label: "Report", icon: <Warning20Icon />, destructive: true, onPress: () => openReportSheetForTarget() }] : []),
          ...(!isOwnContent && canClaimCopyright ? [{ label: "Report copyright", icon: <Warning20Icon />, destructive: true, onPress: () => openReportSheetForTarget("intellectual_property") }] : []),
        ]}
      />
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </>
  );
}

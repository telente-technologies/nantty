import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";

import { ArrowUpRight24Icon, EyeClosed20Icon, Share24Icon, Warning20Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { feedFeedbackService, hidePostFromAllCachedFeeds, type FeedFeedbackType } from "@/services/feedFeedback.service";
import type { ReportTargetType } from "@/services/reports.service";
import { useAuthStore } from "@/store/auth.store";
import type { ID } from "@/types";

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

export function ContentOptionsSheet({ target, onClose, onContentHidden, additionalActions = [] }: ContentOptionsSheetProps) {
  const navigation = useNavigation() as unknown as NavigatorWithRouteNames;
  const queryClient = useQueryClient();
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const isOwnContent = !!target?.authorId && target.authorId === signedInUserId;
  const canGiveFeedFeedback = !!target && !isOwnContent && (target.targetType === "post" || target.targetType === "clip");
  const canPromote = !!target && isOwnContent && target.targetType === "post";

  const hideContentAndSendFeedback = (type: FeedFeedbackType) => {
    if (!target) return;
    const restoreFeeds = hidePostFromAllCachedFeeds(queryClient, target.targetId);
    onContentHidden?.(target.targetId);
    feedFeedbackService.sendFeedFeedbackForPost(target.targetId, type).catch(restoreFeeds);
    onClose();
  };

  const openReportSheetForTarget = () => {
    if (!target) return;
    const nextReportTarget = { targetType: target.targetType, targetId: target.targetId };
    onClose();
    setReportTarget(nextReportTarget);
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
      <BottomSheet visible={!!target} onClose={onClose} floating>
        <View style={styles.options}>
          {additionalActions.map((action) => (
            <OptionRow
              key={action.label}
              icon={action.icon}
              label={action.label}
              onPress={() => {
                onClose();
                action.onPress();
              }}
            />
          ))}
          {canPromote ? <OptionRow icon={<ArrowUpRight24Icon />} label="Promote post" onPress={promoteOwnPost} /> : null}
          {canGiveFeedFeedback ? (
            <>
              <OptionRow icon={<EyeClosed20Icon />} label={`Hide ${noun}`} onPress={() => hideContentAndSendFeedback("hide")} />
              <OptionRow icon={<EyeClosed20Icon />} label="Not interested" onPress={() => hideContentAndSendFeedback("not_interested")} />
            </>
          ) : null}
          {target?.shareUrl ? <OptionRow icon={<Share24Icon />} label="Copy or share link" onPress={shareLinkToContent} /> : null}
          {!isOwnContent ? <OptionRow icon={<Warning20Icon />} label="Report" destructive onPress={openReportSheetForTarget} /> : null}
        </View>
      </BottomSheet>
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </>
  );
}

function OptionRow({ icon, label, onPress, destructive = false }: { icon: ReactNode; label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.optionRow}>
      <View style={styles.optionIcon}>{icon}</View>
      <Text size={15} weight={500} lineHeight={18} color={destructive ? colors.error : colors.text}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  options: { paddingVertical: 8 },
  optionRow: { minHeight: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  optionIcon: { width: 24, alignItems: "center" },
});

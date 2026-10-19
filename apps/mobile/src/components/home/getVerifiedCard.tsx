import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Cancel20Icon } from "@/components/icons";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { GetVerifiedCardState } from "@/utils/getVerifiedCardState.util";

import type { GetVerifiedFeedCardModel } from "./getVerifiedFeedCard.hook";

type VisibleState = Exclude<GetVerifiedCardState, { kind: "hidden" }>;

const checkmarkName = { blue: "Blue", gold: "Gold" } as const;

function copyFor(state: VisibleState) {
  const name = checkmarkName[state.color];
  if (state.kind === "pending") return { title: "Your verification is in review", body: `We'll let you know as soon as your ${name} checkmark is approved.`, action: "View status" };
  if (state.kind === "rejected") return { title: "Your verification wasn't approved", body: state.reason ? `Reason: ${state.reason}` : "See what to fix and try again.", action: "See what to fix" };
  const body = state.color === "blue" ? "Show people it's really you and stand out in comments, search and live." : "Show buyers your business is verified and build trust at checkout.";
  return { title: `Get the ${name} checkmark`, body, action: "Get verified" };
}

export function GetVerifiedCard({ model }: { readonly model: GetVerifiedFeedCardModel }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const recorded = useRef(false);
  const { state, recordImpression } = model;
  useEffect(() => {
    if (recorded.current || state.kind === "hidden") return;
    recorded.current = true;
    recordImpression();
  }, [state.kind, recordImpression]);
  if (state.kind === "hidden") return null;
  const copy = copyFor(state);
  const previewType = state.color === "blue" ? "personal" : "business";
  return (
    <View style={styles.card} accessibilityRole="summary">
      <Pressable accessibilityRole="button" accessibilityLabel="Hide this suggestion for now" hitSlop={10} onPress={model.dismiss} style={styles.close}>
        <Cancel20Icon size={18} color={colors.textMuted} />
      </Pressable>
      <View style={styles.identity}>
        <Avatar uri={model.viewerAvatarUrl} size={44} placeholderColor={colors.primaryTint} />
        <View style={styles.identityText}>
          <View style={styles.nameRow} accessible accessibilityLabel={`${model.viewerName} with the ${checkmarkName[state.color]} checkmark`}>
            <Text size={15} weight={600} numberOfLines={1} style={styles.name}>{model.viewerName}</Text>
            <VerificationBadge verification={{ status: "active", type: previewType, color: state.color, tier: "VERIFIED", badgeVisible: true }} size={16} />
          </View>
          <Text size={12} color={colors.textMuted}>{state.kind === "offer" ? "Preview of your profile" : `${checkmarkName[state.color]} checkmark`}</Text>
        </View>
      </View>
      <Text size={15} weight={600} lineHeight={20} accessibilityRole="header">{copy.title}</Text>
      <Text size={13} lineHeight={18} color={colors.textMuted}>{copy.body}</Text>
      {state.kind === "offer" && model.discountLine ? (
        <View style={styles.discount}>
          <Text size={13} weight={600} lineHeight={18} color={colors.successText}>{model.discountLine}</Text>
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button title={model.hasPersonalOffer ? "Use my offer" : copy.action} height={38} style={styles.primaryAction} onPress={model.openVerificationFlow} />
        <Button variant="subtle" title="Not now" height={38} onPress={model.dismiss} />
      </View>
      {state.kind === "offer" ? (
        <Pressable accessibilityRole="button" onPress={model.neverShowAgain} hitSlop={6} style={styles.never}>
          <Text size={12} weight={500} color={colors.textMuted}>Don't show again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { marginHorizontal: 16, marginVertical: 8, padding: 16, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.elevated },
  close: { position: "absolute", top: 10, right: 10, zIndex: 1, padding: 4 },
  identity: { flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 28 },
  identityText: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { flexShrink: 1 },
  discount: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.successTint },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  primaryAction: { flex: 1 },
  never: { alignSelf: "center", paddingVertical: 4 },
}));

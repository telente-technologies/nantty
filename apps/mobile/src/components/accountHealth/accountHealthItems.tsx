import { Pressable, StyleSheet, View } from "react-native";

import { BulletLine } from "@/components/ui/bulletLine";
import { Text } from "@/components/ui/text";
import { describeAccountStanding, describeRestriction, formatTimeRemaining } from "@/services/account/accountHealth.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { AccountHealth, AccountStrike, CopyrightNotice } from "@/types";

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Never");
const describeContent = (content: { readonly type: string; readonly id: string }) => `${{ clip: "Clip", post: "Post", sound: "Sound", live: "Live video" }[content.type] ?? "Content"} · ${content.id.slice(0, 8)}`;
const describeRemedy = (notice: CopyrightNotice) =>
  ({
    MUTED: "Audio muted, video still up",
    AWAITING_REMOVAL: "Waiting for you to remove it",
    REMOVED_VOLUNTARILY: "You removed it in time: no strike",
    TAKEN_DOWN: "Taken down",
    RESTORED: "Restored after your counter-notice",
    NONE: "Under review",
  })[notice.state];

export function AccountStandingCard({ health }: { readonly health: AccountHealth }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const tone = health.status === "GOOD_STANDING" ? { background: colors.successTint, text: colors.successText } : health.status === "AT_RISK" ? { background: colors.cautionTint, text: colors.cautionStrongText } : { background: colors.errorTint, text: colors.error };
  return (
    <View accessibilityRole="summary" style={[styles.card, { backgroundColor: tone.background }]}>
      <Text size={18} weight={700} lineHeight={23.4} color={tone.text}>{describeAccountStanding(health.status)}</Text>
      <Text size={13} lineHeight={18.2} color={colors.text}>
        {health.activeStrikeCount} of {health.restrictionThreshold} active strikes. Strikes expire after {health.strikeLifetimeDays} days.
      </Text>
      {health.restrictions.length > 0 ? (
        <View style={styles.list}>
          <Text size={13} weight={600} lineHeight={18.2}>Paused on your account</Text>
          {health.restrictions.map((restriction) => <BulletLine key={restriction} size={13} lineHeight={18.2} color={colors.text}>{describeRestriction(restriction)}</BulletLine>)}
        </View>
      ) : null}
    </View>
  );
}

export function StrikeItem({ strike, onAppeal }: { readonly strike: AccountStrike; readonly onAppeal: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.item}>
      <Text size={14} weight={600} lineHeight={18.2}>{strike.policy}</Text>
      <Text size={13} lineHeight={18.2} color={colors.textMuted}>{strike.reason}</Text>
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>
        Issued {formatDate(strike.issuedAt)} · Expires {formatDate(strike.expiresAt)}{strike.affectedContent ? ` · ${describeContent(strike.affectedContent)}` : ""}
      </Text>
      {strike.appealStatus === "PENDING" ? <Text size={12} weight={500} lineHeight={16.8} color={colors.cautionStrongText}>Appeal under review</Text> : null}
      {strike.canAppeal ? <ItemAction label="Appeal" onPress={onAppeal} /> : null}
    </View>
  );
}

export function NoticeItem({ notice, onCounterNotice }: { readonly notice: CopyrightNotice; readonly onCounterNotice: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.item}>
      <Text size={14} weight={600} lineHeight={18.2}>{describeContent(notice.content)}</Text>
      <Text size={13} lineHeight={18.2} color={colors.textMuted}>Claimed by {notice.claimantName} for {notice.workTitle}</Text>
      <Text size={13} weight={500} lineHeight={18.2}>{describeRemedy(notice)}</Text>
      {notice.state === "AWAITING_REMOVAL" && notice.deadlineAt ? (
        <Text size={12} weight={600} lineHeight={16.8} color={colors.cautionStrongText}>{formatTimeRemaining(notice.deadlineAt)} · deadline {new Date(notice.deadlineAt).toLocaleString()}</Text>
      ) : null}
      {notice.counterNoticeStatus ? <Text size={12} lineHeight={16.8} color={colors.textMuted}>Counter-notice: {notice.counterNoticeStatus.toLowerCase()}</Text> : null}
      {notice.canCounterNotice ? <ItemAction label="Send a counter-notice" onPress={onCounterNotice} /> : null}
    </View>
  );
}

function ItemAction({ label, onPress }: { readonly label: string; readonly onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <Text size={13} weight={600} lineHeight={18.2} color={colors.primary}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { padding: 16, borderRadius: 12, gap: 6 },
  list: { gap: 2, marginTop: 6 },
  item: { padding: 14, borderRadius: 10, backgroundColor: colors.elevated, gap: 4 },
}));

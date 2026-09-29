import { ActivityIndicator, ScrollView, Share, StyleSheet, View } from "react-native";

import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { StatusPill, type StatusTone } from "@/components/escrow/statusPill";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useReferralSummaryQuery } from "@/components/wallet/walletQueries.hook";
import { colors } from "@/constants/colors.constant";
import type { ReferralStatus } from "@/types/rewards.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const REFERRAL_STATUS_APPEARANCE: Record<ReferralStatus, { label: string; tone: StatusTone }> = {
  invited: { label: "Invited", tone: "neutral" },
  joined: { label: "Joined", tone: "primary" },
  first_order: { label: "First order placed", tone: "caution" },
  rewarded: { label: "Rewarded", tone: "success" },
};

export function ReferralScreen() {
  const { data: referral, isLoading } = useReferralSummaryQuery();

  if (!referral) {
    return (
      <Screen>
        <Header title="Invite friends" />
        {isLoading ? <ActivityIndicator style={styles.state} color={colors.primary} /> : <Text align="center" style={styles.state}>Couldn't load your invite code.</Text>}
      </Screen>
    );
  }

  const shareInvite = () =>
    Share.share({
      message: `Join me on Zudomart — shop from real sellers with escrow protection. Use my code ${referral.code} for ${formatMoneyForDisplay(referral.rewardForFriend)} off your first order: ${referral.shareUrl}`,
    });

  return (
    <Screen>
      <Header title="Invite friends" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text size={18} weight={600} lineHeight={21.6} align="center">
            Give {formatMoneyForDisplay(referral.rewardForFriend)}, get {formatMoneyForDisplay(referral.rewardForYou)}
          </Text>
          <Text size={13} lineHeight={17.5} color={colors.textMuted} align="center">
            You've earned {formatMoneyForDisplay(referral.totalEarned)} so far.
          </Text>
          <View style={styles.codeBox} accessibilityLabel={`Your invite code ${referral.code.split("").join(" ")}`}>
            <Text size={24} weight={700} lineHeight={28.8} letterSpacing={2} color={colors.primary}>{referral.code}</Text>
          </View>
          <Button title="Share invite link" onPress={shareInvite} />
        </View>
        <View style={styles.card}>
          <Text size={16} weight={600} lineHeight={19.2}>How it works</Text>
          {referral.rules.map((rule, index) => (
            <Text key={rule} size={13} lineHeight={17.5} color={colors.textMuted}>{index + 1}. {rule}</Text>
          ))}
        </View>
        <View style={styles.card}>
          <Text size={16} weight={600} lineHeight={19.2}>Your invites</Text>
          {referral.referrals.length === 0 ? <Text size={13} color={colors.textSubtle}>No invites yet. Share your link to get started.</Text> : null}
          {referral.referrals.map((entry) => (
            <View key={entry.id} style={styles.referralRow}>
              <Avatar uri={entry.avatarUrl} size={36} />
              <View style={styles.flex}>
                <Text size={14} lineHeight={16.8}>{entry.displayName}</Text>
                <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
                  {formatFriendlyDate(entry.updatedAt)}{entry.reward ? ` · +${formatMoneyForDisplay(entry.reward)}` : ""}
                </Text>
              </View>
              <StatusPill label={REFERRAL_STATUS_APPEARANCE[entry.status].label} tone={REFERRAL_STATUS_APPEARANCE[entry.status].tone} />
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  state: { marginTop: 64 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 16 },
  hero: { backgroundColor: colors.white, borderRadius: 12, padding: 20, gap: 12 },
  codeBox: { alignSelf: "center", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: colors.primary, backgroundColor: colors.primaryTint },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 16, gap: 10 },
  referralRow: { flexDirection: "row", alignItems: "center", gap: 12 },
});

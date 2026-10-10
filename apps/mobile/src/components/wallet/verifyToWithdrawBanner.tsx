import { useNavigation } from "@react-navigation/native";
import { StyleSheet, View } from "react-native";

import { ShieldCheck24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { WalletSummary } from "@/types";
import { walletVerificationMessage } from "@/utils/walletLines.util";

export function VerifyToWithdrawBanner({ wallet }: { readonly wallet: WalletSummary | undefined }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const message = walletVerificationMessage(wallet);
  if (!message) return null;
  const nextStep = wallet?.verification?.nextStep;
  const identityStep = nextStep === "identity_check";
  const businessStep = nextStep === "business_verification";
  const openVerification = () =>
    identityStep ? navigation.navigate("IdentityVerification") : navigation.navigate("PayoutSetup", businessStep ? { context: "seller" } : undefined);

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.titleRow}>
        <ShieldCheck24Icon size={20} color={colors.primary} />
        <Text size={15} weight={600} lineHeight={19.5} style={styles.title}>{message}</Text>
      </View>
      <Text size={13} lineHeight={18} color={colors.textMuted}>
        Your money stays safe in your wallet and keeps waiting for you. Verifying your payout details takes a few minutes.
      </Text>
      <Button title={identityStep ? "Verify identity" : businessStep ? "Finish business verification" : "Get paid"} height={40} accessibilityLabel={`${message}. Open payout verification`} onPress={openVerification} />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.primaryTint, borderRadius: 12, padding: 14, gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1 },
}));

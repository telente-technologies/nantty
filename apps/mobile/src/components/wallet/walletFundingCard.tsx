import { useNavigation } from "@react-navigation/native";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { OUTSIDE_NIGERIA_NOTE } from "@/utils/paymentCopy.util";

import { useProviderWallet } from "./providerWalletQueries.hook";

export function WalletFundingCard() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { isNigeria, wallet, isMissing } = useProviderWallet();
  if (isNigeria === null) return null;
  if (!isNigeria) {
    return <Text size={12} lineHeight={16.8} color={colors.textMuted}>{OUTSIDE_NIGERIA_NOTE}</Text>;
  }
  const account = wallet.data?.wallet;
  return (
    <View style={styles.card}>
      <Text size={13} lineHeight={18} color={colors.textMuted}>
        {account
          ? `Your wallet account: ${account.bankName} ${account.accountNumber}. It's held in your name by our licensed payment partner.`
          : isMissing
            ? "Finish payout verification to get your own account number for adding money."
            : "Your wallet is held in your name by our licensed payment partner."}
      </Text>
      <Button title="Add money" variant="subtle" height={40} onPress={() => navigation.navigate("AddMoney")} />
    </View>
  );
}

const styles = StyleSheet.create({ card: { gap: 8 } });

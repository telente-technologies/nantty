import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ConvertEarnedCoinsSheet } from "@/components/coins/convertEarnedCoinsSheet";
import { formatCoinAmount, useCoinBalance } from "@/components/coins/coinWallet.hook";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export function StudioCoinsSection({ onOpenActivity }: { onOpenActivity: () => void }) {
  const balance = useCoinBalance();
  const [convertVisible, setConvertVisible] = useState(false);
  const earned = balance.data?.earnedCoins ?? 0;
  return (
    <View style={styles.card}>
      <Text size={16} weight={600} lineHeight={19.2}>Coins</Text>
      <View style={styles.row}>
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>Balance</Text>
        <Text size={13} weight={500} lineHeight={16.9}>{formatCoinAmount(balance.data?.coins ?? 0)}</Text>
      </View>
      <View style={styles.row}>
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>Earned</Text>
        <Text size={13} weight={500} lineHeight={16.9}>{formatCoinAmount(earned)}</Text>
      </View>
      <Button title="Convert earned coins" onPress={() => setConvertVisible(true)} />
      <Button variant="subtle" title="Coin activity" onPress={onOpenActivity} />
      <ConvertEarnedCoinsSheet visible={convertVisible} onClose={() => setConvertVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 16, gap: 12 },
  row: { flexDirection: "row", justifyContent: "space-between" },
});

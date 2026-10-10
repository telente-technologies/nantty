import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { supportService } from "@/services/support/support.service";

const scores = [1, 2, 3, 4, 5] as const;

export function TicketRatingCard({ ticketId, onRated }: { readonly ticketId: string; readonly onRated: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [score, setScore] = useState<number | null>(null);
  const rate = useMutation({ mutationFn: (value: number) => supportService.rateSupportTicket(ticketId, value, null), onSuccess: onRated });
  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text size={14} weight={600}>How happy are you with the help you got?</Text>
      <Text size={12} lineHeight={16} color={colors.textMuted}>1 is not happy, 5 is very happy.</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {scores.map((value) => (
          <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: score === value }} accessibilityLabel={`${value} out of 5`} onPress={() => setScore(value)} style={[styles.score, score === value && styles.selected]}>
            <Text size={15} weight={600} color={score === value ? colors.white : colors.text}>{value}</Text>
          </Pressable>
        ))}
      </View>
      {rate.isError ? <Text size={12} color={colors.error}>{rate.error.message}</Text> : null}
      <Button title="Send rating" disabled={score === null} loading={rate.isPending} onPress={() => score !== null && rate.mutate(score)} />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 10 },
  row: { flexDirection: "row", gap: 8 },
  score: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center" },
  selected: { backgroundColor: colors.primarySolid, borderColor: colors.primarySolid },
}));

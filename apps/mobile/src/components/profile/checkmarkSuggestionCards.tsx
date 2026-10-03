import { useNavigation } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { VerificationBadge } from "@/components/profile/verificationBadge";
import { useCheckmarkSuggestionsQuery, verificationQueryKeys } from "@/components/profile/verificationQueries.hook";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { verificationService } from "@/services/verification.service";
import { useAuthStore } from "@/store/auth.store";
import type { CheckmarkSuggestion } from "@/types/trust.type";

export function CheckmarkSuggestionCards() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const suggestions = useCheckmarkSuggestionsQuery();
  const dismiss = useMutation({
    mutationFn: (color: CheckmarkSuggestion["color"]) => verificationService.dismissCheckmarkSuggestion(color),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: verificationQueryKeys.suggestions }),
  });
  const visible = isSignedIn ? (suggestions.data ?? []).filter((suggestion) => suggestion.eligible && !suggestion.dismissed) : [];

  return (
    <>
      {visible.map((suggestion) => (
        <View key={suggestion.color} style={styles.card}>
          <View style={styles.titleRow}>
            <VerificationBadge verification={{ status: "active", type: suggestion.color === "blue" ? "personal" : "business", color: suggestion.color, tier: "VERIFIED", badgeVisible: true }} size={20} />
            <Text size={14} weight={600} lineHeight={16.8} style={styles.title}>{suggestion.headline}</Text>
          </View>
          <Text size={13} lineHeight={17.5} color={colors.textMuted}>{suggestion.detail}</Text>
          <View style={styles.actions}>
            <Button title="Apply" height={38} style={styles.action} onPress={() => navigation.navigate("VerificationApply", { color: suggestion.color })} />
            <Button variant="subtle" title="Not now" height={38} style={styles.action} loading={dismiss.isPending && dismiss.variables === suggestion.color} onPress={() => dismiss.mutate(suggestion.color)} />
          </View>
        </View>
      ))}
    </>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1 },
  actions: { flexDirection: "row", gap: 8 },
  action: { flex: 1 },
}));

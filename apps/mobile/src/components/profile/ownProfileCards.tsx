import { StyleSheet, View } from "react-native";

import { makeThemedStyles } from "@/theme";
import type { User } from "@/types";

import { CheckmarkSuggestionCards } from "./checkmarkSuggestionCards";
import { StartSellingCard } from "./startSellingCard";
import { spacing } from "@/constants/spacing.constant";

export function OwnProfileCards({ profile }: { profile: User }) {
  const styles = useStyles();
  return (
    <>
      <View style={styles.suggestions}><CheckmarkSuggestionCards /></View>
      {profile.isSeller ? null : <StartSellingCard compact />}
    </>
  );
}

const useStyles = makeThemedStyles(() => StyleSheet.create({
  suggestions: { paddingHorizontal: spacing[3], gap: spacing[2] },
}));

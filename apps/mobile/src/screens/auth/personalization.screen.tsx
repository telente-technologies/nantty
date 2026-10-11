import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomizingFeedIllustration } from "@/components/auth/customizingFeedIllustration";
import { ArrowLeft24Icon } from "@/components/icons";
import { BrandLoader } from "@/components/ui/brandLoader";
import { Button } from "@/components/ui/button";
import { Chip, chipStyles } from "@/components/ui/chip";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { AuthScreenProps } from "@/navigation/navigation.types";
import { authService } from "@/services/auth/auth.service";
import { useAuthStore } from "@/store/auth.store";
import { useSignUpStore } from "@/store/signup.store";

const MINIMUM_TOPICS_TO_CONTINUE = 3;
const MINIMUM_CUSTOMIZING_SCREEN_DURATION_MS = 1500;

export function PersonalizationScreen({ navigation }: AuthScreenProps<"Personalization">) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pendingSession = useSignUpStore((state) => state.pendingSession);
  const clearSignUpDraft = useSignUpStore((state) => state.clearSignUpDraft);
  const saveSignedInSession = useAuthStore((state) => state.saveSignedInSession);
  const [selectedTopicIds, setSelectedTopicIds] = useState<ReadonlySet<string>>(new Set());
  const [customizingFeed, setCustomizingFeed] = useState(false);
  const topicsQuery = useQuery({ queryKey: ["personalization-topics"], queryFn: authService.fetchPersonalizationTopics });

  const toggleTopicSelection = (topicId: string) =>
    setSelectedTopicIds((current) => {
      const next = new Set(current);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });

  const finishSignUpAndOpenApp = async () => {
    clearSignUpDraft();
    if (pendingSession) await saveSignedInSession(pendingSession);
  };

  const saveSelectedTopicsAndOpenApp = async () => {
    setCustomizingFeed(true);
    const minimumDelay = new Promise((resolve) => setTimeout(resolve, MINIMUM_CUSTOMIZING_SCREEN_DURATION_MS));
    await Promise.all([authService.saveSelectedTopics([...selectedTopicIds]).catch(() => undefined), minimumDelay]);
    await finishSignUpAndOpenApp();
  };

  return (
    <Screen>
      <View style={styles.header}>
        {navigation.canGoBack() && !customizingFeed ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={() => navigation.goBack()}>
            <ArrowLeft24Icon />
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable accessibilityRole="button" hitSlop={12} disabled={customizingFeed} onPress={finishSignUpAndOpenApp}>
          <Text size={13} weight={500} lineHeight={16.9}>
            Skip
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text size={16} weight={500} lineHeight={19.2} accessibilityRole="header">
            Personalize your feed
          </Text>
          <Text size={14} lineHeight={16.8} color={colors.textSubtle}>
            {customizingFeed ? "Customizing your feed..." : "Add or edit topics you follow. Chose three or more."}
          </Text>
        </View>

        {customizingFeed ? (
          <View style={styles.illustration}>
            <CustomizingFeedIllustration />
          </View>
        ) : topicsQuery.isLoading ? (
          <BrandLoader size="md" style={styles.loader} />
        ) : (
          <View style={[chipStyles.row, styles.topics]}>
            {(topicsQuery.data ?? []).map((topic) => (
              <Chip
                key={topic.id}
                kind="topic"
                label={topic.name}
                selected={selectedTopicIds.has(topic.id)}
                onPress={() => toggleTopicSelection(topic.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {customizingFeed ? null : (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 34 }]}>
          <Button
            title="Continue"
            disabled={selectedTopicIds.size < MINIMUM_TOPICS_TO_CONTINUE}
            onPress={saveSelectedTopicsAndOpenApp}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 24, marginTop: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },
  heading: { gap: 8 },
  topics: { marginTop: 29, rowGap: 16 },
  loader: { marginTop: 40 },
  illustration: { marginTop: 124, marginHorizontal: -16 },
  footer: { paddingHorizontal: 24 },
});

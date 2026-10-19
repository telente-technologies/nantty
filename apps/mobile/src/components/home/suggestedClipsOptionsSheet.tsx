import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { EyeSlash24Icon, Info24Icon, Prohibit24Icon } from "@/components/icons";
import { ActionSheet } from "@/components/ui/actionSheet";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { modalMotion } from "@/components/ui/modalChrome.constant";
import { Text } from "@/components/ui/text";
import { suggestedClipsHiddenDays, suggestedClipsNotInterestedCooldownDays } from "@/constants/feedModules.constant";
import { feedsService } from "@/services/feed/feeds.service";
import { useAuthStore } from "@/store/auth.store";
import { useFeedModulePreferencesStore } from "@/store/feedModulePreferences.store";
import { showToast } from "@/store/toast.store";
import { useTheme } from "@/theme";

export interface SuggestedClipsOptionsSheetProps {
  readonly visible: boolean;
  readonly railClipIds: readonly string[];
  readonly onClose: () => void;
}

const reasonsForSuggestedClips = [
  "They're popular with people who watch clips like the ones you've liked, shared or watched to the end.",
  "Some come from creators you don't follow yet, so you can discover new people.",
  "They never come from accounts you've blocked.",
];

export function SuggestedClipsOptionsSheet({ visible, railClipIds, onClose }: SuggestedClipsOptionsSheetProps) {
  const { colors } = useTheme();
  const viewerId = useAuthStore((state) => (state.status === "signedIn" ? state.user?.id ?? null : null));
  const hideSuggestedClipsForDays = useFeedModulePreferencesStore((state) => state.hideSuggestedClipsForDays);
  const [explanationVisible, setExplanationVisible] = useState(false);

  const markNotInterested = () => {
    hideSuggestedClipsForDays(viewerId, suggestedClipsNotInterestedCooldownDays);
    if (viewerId !== null) void feedsService.sendShowFewerClipsLikeThese(railClipIds);
    showToast("Got it. You'll see fewer clips like these.");
  };
  const hideForThirtyDays = () => {
    hideSuggestedClipsForDays(viewerId, suggestedClipsHiddenDays);
    showToast(`Suggested videos are hidden for ${suggestedClipsHiddenDays} days.`);
  };

  return (
    <>
      <ActionSheet
        visible={visible}
        onClose={onClose}
        title="Suggested clips"
        options={[
          { label: "Not interested in these", detail: "We'll show fewer clips like these", icon: <Prohibit24Icon size={22} color={colors.text} />, onPress: markNotInterested },
          { label: `Hide suggested videos for ${suggestedClipsHiddenDays} days`, icon: <EyeSlash24Icon size={22} color={colors.text} />, onPress: hideForThirtyDays },
          { label: "Why am I seeing this?", icon: <Info24Icon size={22} color={colors.text} />, onPress: () => setTimeout(() => setExplanationVisible(true), modalMotion.exitMs + 120) },
        ]}
      />
      <BottomSheet visible={explanationVisible} onClose={() => setExplanationVisible(false)} title="Why you're seeing suggested clips" footerActions={[{ label: "Got it", onPress: () => setExplanationVisible(false) }]}>
        <View style={styles.reasons}>
          {reasonsForSuggestedClips.map((reason) => (
            <Text key={reason} size={14} lineHeight={20} color={colors.textMuted}>
              {reason}
            </Text>
          ))}
          <Text size={14} lineHeight={20} color={colors.textMuted}>
            Use the menu on the row to see fewer of them or hide them for a while.
          </Text>
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({ reasons: { gap: 12, paddingBottom: 8 } });

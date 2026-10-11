import { useNavigation, type NavigationProp } from "@react-navigation/native";

import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import type { MainStackParamList } from "@/navigation/navigation.types";
import { useTheme } from "@/theme";

export const VIEWS_HELP_TOPIC_SLUG = "views-and-analytics";
export const VIEWS_EXPLAINER_TEXT =
  "Times this post was seen. A view counts each time it appears on someone else's screen, including repeat views. The author's own views don't count.";

export interface ViewsExplainerSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
}

export function ViewsExplainerSheet({ visible, onClose }: ViewsExplainerSheetProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const openViewsHelpArticle = () => {
    onClose();
    navigation.navigate("HelpArticle", { topicSlug: VIEWS_HELP_TOPIC_SLUG });
  };
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Views"
      scrollable
      footerActions={[{ label: "Learn more", style: "primary", onPress: openViewsHelpArticle, accessibilityHint: "Opens the help article About views" }]}
    >
      <Text size={14} lineHeight={20} color={colors.textMuted} maxFontSizeMultiplier={1.8}>
        {VIEWS_EXPLAINER_TEXT}
      </Text>
    </BottomSheet>
  );
}

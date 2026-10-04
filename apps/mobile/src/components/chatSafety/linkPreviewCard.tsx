import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { confirmRiskyLink, inAppBrowserColorsFromTheme, openInAppBrowser } from "@/components/links/openLink.util";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { readFullDomain } from "@/components/chat/chatLinks.util";
import type { LinkPreview } from "@/types";

export interface LinkPreviewCardProps {
  readonly url: string;
  readonly preview: LinkPreview | null | undefined;
}

export function LinkPreviewCard({ url, preview }: LinkPreviewCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const domain = preview?.domain ?? readFullDomain(url);
  const openWithSafetyCheck = () => confirmRiskyLink(url, () => void openInAppBrowser(url, inAppBrowserColorsFromTheme(colors)));
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`Link to ${domain}${preview ? `, ${preview.title}` : ""}`} onPress={openWithSafetyCheck} style={styles.card}>
      {preview?.imageUrl ? <Image source={{ uri: preview.imageUrl }} style={styles.image} contentFit="cover" /> : null}
      <View style={styles.body}>
        <Text size={13} weight={600} lineHeight={17} numberOfLines={2}>{preview?.title ?? domain}</Text>
        {preview?.description ? <Text size={12} lineHeight={16} color={colors.textMuted} numberOfLines={2}>{preview.description}</Text> : null}
        <Text size={11} lineHeight={14} color={colors.textSubtle} numberOfLines={1}>{domain}</Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { width: 240, borderRadius: 12, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  image: { width: "100%", height: 120 },
  body: { padding: 10, gap: 3 },
}));

import { Image } from "expo-image";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { assessLinkRisk, readFullDomain } from "@/components/chat/chatLinks.util";
import type { LinkPreview } from "@/types";

export interface LinkPreviewCardProps {
  readonly url: string;
  readonly preview: LinkPreview | null | undefined;
}

export function LinkPreviewCard({ url, preview }: LinkPreviewCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const risk = assessLinkRisk(url);
  const domain = preview?.domain ?? readFullDomain(url);
  const openLink = () => {
    setIsWarningVisible(false);
    Linking.openURL(url).catch(() => undefined);
  };
  return (
    <>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Link to ${domain}${preview ? `, ${preview.title}` : ""}`}
        onPress={risk === "safe" ? openLink : () => setIsWarningVisible(true)}
        style={styles.card}
      >
        {preview?.imageUrl ? <Image source={{ uri: preview.imageUrl }} style={styles.image} contentFit="cover" /> : null}
        <View style={styles.body}>
          <Text size={13} weight={600} lineHeight={17} numberOfLines={2}>{preview?.title ?? domain}</Text>
          {preview?.description ? <Text size={12} lineHeight={16} color={colors.textMuted} numberOfLines={2}>{preview.description}</Text> : null}
          <Text size={11} lineHeight={14} color={colors.textSubtle} numberOfLines={1}>{domain}</Text>
        </View>
      </Pressable>
      <BottomSheet visible={isWarningVisible} onClose={() => setIsWarningVisible(false)} title={risk === "shortened" ? "Shortened link" : "Suspicious link"}>
        <View style={styles.warning}>
          <Text size={14} lineHeight={20}>
            {risk === "shortened"
              ? "This link hides its real destination. Only open it if you trust the sender."
              : "This address looks unusual and may be unsafe. Do not enter passwords or payment details."}
          </Text>
          <Text size={13} weight={600} lineHeight={18} color={colors.error}>{domain}</Text>
          <Button title="Open anyway" variant="danger" onPress={openLink} />
          <Button title="Cancel" variant="outline" onPress={() => setIsWarningVisible(false)} />
        </View>
      </BottomSheet>
    </>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { width: 240, borderRadius: 12, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  image: { width: "100%", height: 120 },
  body: { padding: 10, gap: 3 },
  warning: { gap: 12, paddingHorizontal: 20, paddingBottom: 20 },
}));

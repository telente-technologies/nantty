import { StyleSheet, View } from "react-native";

import { VideoCamera24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { LiveHostingSupport } from "@/services/live/liveHostingSupport.service";
import { makeThemedStyles, useTheme } from "@/theme";

export interface LiveHostingGateProps {
  readonly support: Exclude<LiveHostingSupport, "ready" | "noVideoEngine">;
  readonly canPreviewWithMocks: boolean;
  readonly onPreviewWithMocks: () => void;
  readonly onClose: () => void;
}

const gateCopy = {
  expoGo: {
    title: "Going live needs the Zudomart app build",
    body: "Expo Go can't stream live video, so going live is switched off here. Watching lives, chat and gifts still work.",
    note: "Developers: install a development build (eas build --profile development) and open the project in it to go live.",
  },
  web: {
    title: "Going live is on the Zudomart phone app",
    body: "Open Zudomart on your phone to go live. You can still watch lives here.",
    note: null,
  },
} as const;

export function LiveHostingGate({ support, canPreviewWithMocks, onPreviewWithMocks, onClose }: LiveHostingGateProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const copy = gateCopy[support];
  return (
    <View style={styles.root} accessibilityRole="summary" testID="live-hosting-gate">
      <VideoCamera24Icon size={40} color={colors.primary} />
      <Text size={20} weight={700} lineHeight={26} align="center">{copy.title}</Text>
      <Text size={15} lineHeight={22} align="center" color={colors.textMuted}>{copy.body}</Text>
      {copy.note ? (
        <Text size={13} lineHeight={18} align="center" color={colors.textMuted}>{copy.note}</Text>
      ) : null}
      {canPreviewWithMocks ? <Button title="Try the live screens with mock data" onPress={onPreviewWithMocks} /> : null}
      <Button title="Not now" variant="outline" onPress={onClose} />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, alignItems: "stretch", justifyContent: "center", gap: 16, paddingHorizontal: 28 },
}));

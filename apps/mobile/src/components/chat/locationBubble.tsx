import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { stopSharingLiveLocation } from "@/services/live/liveLocationSharing.service";
import { useIsSharingLiveLocation } from "@/store/liveLocationShares.store";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Message } from "@/types";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { buildMapsUrl, formatLiveUntilTime } from "@/utils/mapLinks.util";

import { storeDeliveredMessage } from "@/cache/messageRealtimeCache.util";
import { useQueryClient } from "@tanstack/react-query";
import { StaticMapPreview } from "./staticMapPreview";

const LIVE_STATE_REFRESH_MS = 30_000;
const COPIED_LABEL_VISIBLE_MS = 2000;

const formatCoordinates = (latitude: number, longitude: number) => `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

export function LocationBubble({ message, isMine }: { readonly message: Message; readonly isMine: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const location = message.location!;
  const isSharingFromThisDevice = useIsSharingLiveLocation(message.id);
  const queryClient = useQueryClient();
  const [, refreshLiveState] = useState(0);
  const [hasCopiedAddress, setHasCopiedAddress] = useState(false);
  const isLiveKind = message.kind === "liveLocation";
  const isLiveNow = isLiveKind && !!location.liveUntil && location.liveUntil > new Date().toISOString() && (!isMine || isSharingFromThisDevice);
  const addressLine = location.address ?? formatCoordinates(location.latitude, location.longitude);

  useEffect(() => {
    if (!isLiveNow) return;
    const timer = setInterval(() => refreshLiveState((count) => count + 1), LIVE_STATE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isLiveNow]);

  const openInMaps = () => {
    Linking.openURL(buildMapsUrl(location.latitude, location.longitude, location.address)).catch(() =>
      showAlertWithButtons("Couldn't open maps", "No maps app could open this location.", undefined, { intent: "location" }),
    );
  };

  const copyAddress = async () => {
    await Clipboard.setStringAsync(addressLine);
    setHasCopiedAddress(true);
    setTimeout(() => setHasCopiedAddress(false), COPIED_LABEL_VISIBLE_MS);
  };

  const stopSharing = () => {
    stopSharingLiveLocation(message.conversationId, message.id, (control) => storeDeliveredMessage(queryClient, control)).catch(() => showAlertWithButtons("Couldn't stop sharing", "Please try again.", undefined, { intent: "location" }));
  };

  return (
    <View style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${addressLine} in maps`} onPress={openInMaps}>
        <StaticMapPreview latitude={location.latitude} longitude={location.longitude} />
      </Pressable>
      {isLiveKind ? (
        <View style={styles.liveRow} accessibilityLiveRegion="polite">
          <View style={[styles.liveDot, { backgroundColor: isLiveNow ? colors.live : colors.textMuted }]} />
          <Text size={13} weight={600} lineHeight={16.9}>
            {isLiveNow ? `Live until ${formatLiveUntilTime(location.liveUntil!)}` : "Live location ended"}
          </Text>
        </View>
      ) : null}
      <Text size={13} lineHeight={16.9} numberOfLines={2}>
        {addressLine}
      </Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" hitSlop={14} onPress={openInMaps}>
          <Text size={13} weight={600} lineHeight={16.9} color={colors.primary}>Open in maps</Text>
        </Pressable>
        <Pressable accessibilityRole="button" hitSlop={14} onPress={() => void copyAddress()}>
          <Text size={13} weight={600} lineHeight={16.9} color={colors.primary}>{hasCopiedAddress ? "Copied" : "Copy address"}</Text>
        </Pressable>
      </View>
      {isLiveNow && isMine ? (
        <Pressable accessibilityRole="button" onPress={stopSharing} style={styles.stopButton}>
          <Text size={13} weight={600} lineHeight={16.9} color={colors.error} align="center">Stop sharing</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { width: 232, gap: 8 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  actions: { flexDirection: "row", gap: 16 },
  stopButton: { borderWidth: 1, borderColor: colors.error, borderRadius: 8, paddingVertical: 8 },
}));

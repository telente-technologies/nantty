import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { MapPin24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { BrandLoader } from "@/components/ui/brandLoader";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { readChatLocationConsent, readCurrentSharedLocation, requestLocationAccess, saveChatLocationConsent } from "@/services/chat/locationSharing.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { SharedLocation } from "@/types";

const LIVE_LOCATION_DURATIONS = [
  { label: "15 minutes", minutes: 15 },
  { label: "1 hour", minutes: 60 },
  { label: "8 hours", minutes: 480 },
] as const;

export interface ChatLocationSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSendCurrentLocation: (location: SharedLocation) => void;
  readonly onStartLiveLocation: (location: SharedLocation, durationMinutes: number) => void;
}

export function ChatLocationSheet({ visible, onClose, onSendCurrentLocation, onStartLiveLocation }: ChatLocationSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [hasConsented, setHasConsented] = useState<boolean | null>(null);
  const [accessProblem, setAccessProblem] = useState<"denied" | "blocked" | "unavailable" | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setAccessProblem(null);
    readChatLocationConsent().then(setHasConsented);
  }, [visible]);

  const acceptConsent = async () => {
    await saveChatLocationConsent();
    setHasConsented(true);
  };

  const shareAfterLocating = async (share: (location: SharedLocation) => void) => {
    setIsLocating(true);
    try {
      const access = await requestLocationAccess();
      if (access !== "granted") {
        setAccessProblem(access);
        return;
      }
      share(await readCurrentSharedLocation());
      onClose();
    } catch {
      setAccessProblem("unavailable");
    } finally {
      setIsLocating(false);
    }
  };

  const renderChoiceRow = (label: string, onPress: () => void, icon?: boolean) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} disabled={isLocating} onPress={onPress} style={styles.row}>
      {icon ? <MapPin24Icon /> : <View style={styles.rowIconSpacer} />}
      <Text size={15} lineHeight={19.5}>{label}</Text>
    </Pressable>
  );

  const renderBody = () => {
    if (hasConsented === null) return <BrandLoader size="md" style={styles.loader} />;
    if (!hasConsented) {
      return (
        <View style={styles.message}>
          <Text size={15} weight={600} lineHeight={19.5}>Your location is shared only with this chat</Text>
          <Text size={13} lineHeight={18.2} color={colors.textMuted}>
            Zudomart only reads your position when you choose to share it. Live location stops by itself at the end time you pick, or when you tap Stop sharing.
          </Text>
          <Button title="Continue" onPress={() => void acceptConsent()} />
          <Button title="Not now" variant="outline" onPress={onClose} />
        </View>
      );
    }
    if (accessProblem) {
      const isBlocked = accessProblem === "blocked";
      return (
        <View style={styles.message}>
          <Text size={15} weight={600} lineHeight={19.5}>{accessProblem === "unavailable" ? "Couldn't find your location" : "Location access is off"}</Text>
          <Text size={13} lineHeight={18.2} color={colors.textMuted}>
            {accessProblem === "unavailable"
              ? "Check that location services are on and try again."
              : isBlocked
                ? "Allow Zudomart to use your location in Settings to share it in chats."
                : "Zudomart needs permission to read your location before it can share it."}
          </Text>
          {isBlocked ? (
            <Button title="Open Settings" onPress={() => void Linking.openSettings()} />
          ) : (
            <Button title={"Try again"} onPress={() => setAccessProblem(null)} />
          )}
        </View>
      );
    }
    return (
      <View>
        {renderChoiceRow("Send current location", () => void shareAfterLocating(onSendCurrentLocation), true)}
        <Text size={12} weight={600} lineHeight={15.6} letterSpacing={0} color={colors.textMuted} style={styles.sectionLabel}>
          Share live location for
        </Text>
        {LIVE_LOCATION_DURATIONS.map((duration) =>
          renderChoiceRow(duration.label, () => void shareAfterLocating((location) => onStartLiveLocation(location, duration.minutes))),
        )}
        {isLocating ? <BrandLoader size="sm" label="Finding your location…" style={styles.spinner} /> : null}
      </View>
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Share location">
      <View style={styles.body}>{renderBody()}</View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles(() => StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 12 },
  message: { gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  rowIconSpacer: { width: 24 },
  sectionLabel: { marginTop: 8 },
  spinner: { marginTop: 8 },
  loader: { paddingVertical: 24 },
}));

import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Warning20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { formatTimeRemaining } from "@/services/account/accountHealth.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ID } from "@/types";

import { usePendingCopyrightNoticeFor } from "./accountHealth.hook";

export function CopyrightCountdownBanner({ contentId, onOpenAccountStatus }: { readonly contentId: ID; readonly onOpenAccountStatus: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const notice = usePendingCopyrightNoticeFor(contentId);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!notice) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [notice]);
  if (!notice?.deadlineAt) return null;
  const remaining = formatTimeRemaining(notice.deadlineAt, now);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Copyright warning. ${remaining} to remove this content. Open account status`} onPress={onOpenAccountStatus} style={styles.banner}>
      <Warning20Icon color={colors.cautionStrongText} />
      <View style={styles.text}>
        <Text size={13} weight={600} lineHeight={16.9} color={colors.cautionStrongText}>
          Copyright warning · {remaining}
        </Text>
        <Text size={12} lineHeight={16.8} color={colors.cautionText}>
          Remove this before the deadline to avoid a strike, or send a counter-notice.
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  banner: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 10, backgroundColor: colors.cautionTint },
  text: { flex: 1, gap: 2 },
}));

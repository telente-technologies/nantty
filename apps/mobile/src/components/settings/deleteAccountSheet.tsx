import { useMutation } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { EyeSlash24Icon, FileLock24Icon, Trash24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { consentsService } from "@/services/account/consents.service";
import { useAuthStore } from "@/store/auth.store";
import { BulletLine } from "@/components/ui/bulletLine";

const CONFIRMATION_WORD = "DELETE";

const DELETED = ["Your profile, bio and photos", "Your posts, clips, stories and comments", "Your saved addresses, payment methods and preferences"];
const ANONYMIZED = ["Reviews and chat messages you sent stay visible without your name or photo", "Product interaction data is stripped of anything that identifies you"];
const RETAINED = ["Orders, payments, payouts and escrow records may be kept for as long as the law requires for tax, fraud and dispute purposes"];

function Section({ title, lines, icon }: { title: string; lines: string[]; icon: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon}
        <Text size={13} weight={600} lineHeight={16.9}>{title}</Text>
      </View>
      {lines.map((line) => (
        <BulletLine key={line} size={13} lineHeight={18}>{line}</BulletLine>
      ))}
    </View>
  );
}

export function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const [confirmation, setConfirmation] = useState("");
  const signOut = useAuthStore((state) => state.clearSessionAndSignOut);
  const requestDeletion = useMutation({
    mutationFn: () => consentsService.requestAccountDeletion(confirmation.trim()),
    onSuccess: () => signOut(),
  });

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Delete my account"
      subtitle="Your account will be permanently deleted in 30 days. Log in any time before then to cancel."
      scrollable
      footerActions={[
        { label: "Delete my account", style: "destructive", disabled: confirmation.trim() !== CONFIRMATION_WORD, loading: requestDeletion.isPending, onPress: () => requestDeletion.mutate() },
        { label: "Keep my account", style: "secondary", onPress: onClose },
      ]}
    >
      <View style={styles.content}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.errorTint }}>
          <Trash24Icon size={22} color={colors.error} />
        </View>
        <Section title="What gets deleted" lines={DELETED} icon={<Trash24Icon size={20} color={colors.error} />} />
        <Section title="What gets anonymized" lines={ANONYMIZED} icon={<EyeSlash24Icon size={20} color={colors.textMuted} />} />
        <Section title="What we may keep" lines={RETAINED} icon={<FileLock24Icon size={20} color={colors.textMuted} />} />
        <TextField label={`Type ${CONFIRMATION_WORD} to confirm`} value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} />
        {requestDeletion.isError ? <Text size={12} lineHeight={16} color={colors.error} accessibilityRole="alert">{requestDeletion.error.message}</Text> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ content: { paddingTop: 4, gap: 16 }, section: { gap: 4 } });

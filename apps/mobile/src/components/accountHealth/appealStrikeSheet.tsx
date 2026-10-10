import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { SealCheck20Icon, ShieldCheck24Icon } from "@/components/icons";
import { ClaimTextField } from "@/components/moderation/copyrightClaimFields";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { AccountStrike } from "@/types";

import { useAppealStrike } from "./accountHealth.hook";

export function AppealStrikeSheet({ strike, onClose }: { readonly strike: AccountStrike | null; readonly onClose: () => void }) {
  const { colors } = useTheme();
  const [message, setMessage] = useState("");
  const appeal = useAppealStrike();
  useEffect(() => {
    setMessage("");
    appeal.reset();
  }, [strike?.id]);
  return (
    <BottomSheet visible={!!strike} onClose={onClose} title={appeal.isSuccess ? "Appeal sent" : `Appeal this ${strike?.kind === "WARNING" ? "warning" : "strike"}`}>
      <View style={styles.body}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          {appeal.isSuccess ? <SealCheck20Icon size={22} color={colors.textMuted} /> : <ShieldCheck24Icon size={22} color={colors.textMuted} />}
        </View>
        {appeal.isSuccess ? (
          <Text size={14} lineHeight={19.6} color={colors.textMuted}>
            A different reviewer will look at your appeal. We'll let you know the outcome by email and in your notifications.
          </Text>
        ) : (
          <>
            <Text size={13} lineHeight={18.2} color={colors.textMuted}>{strike?.reason}</Text>
            <ClaimTextField label="Why should we remove it?" value={message} onChangeText={setMessage} multiline maximumLength={2000} hint="At least 20 characters." />
            {appeal.isError ? <Text size={13} lineHeight={16.9} color={colors.error}>{appeal.error instanceof Error ? appeal.error.message : "Couldn't send. Try again."}</Text> : null}
            <Button title="Send appeal" disabled={message.trim().length < 20} loading={appeal.isPending} onPress={() => strike && appeal.mutate({ strikeId: strike.id, message: message.trim() })} />
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 } });

import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Scales24Icon, SealCheck20Icon } from "@/components/icons";
import { ClaimCheckbox, ClaimTextField } from "@/components/moderation/copyrightClaimFields";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { COUNTER_NOTICE_DECLARATION } from "@/constants/copyrightLegal.constant";
import { isValidContactEmailAddress } from "@/services/moderation/copyrightClaims.service";
import { useTheme } from "@/theme";
import type { CopyrightNotice } from "@/types";

import { useSubmitCounterNotice } from "./accountHealth.hook";

export function CounterNoticeSheet({ notice, onClose }: { readonly notice: CopyrightNotice | null; readonly onClose: () => void }) {
  const { colors } = useTheme();
  const [statement, setStatement] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [hasDeclared, setHasDeclared] = useState(false);
  const submit = useSubmitCounterNotice();
  useEffect(() => {
    setStatement("");
    setHasDeclared(false);
    submit.reset();
  }, [notice?.claimId]);
  const canSubmit = statement.trim().length >= 20 && isValidContactEmailAddress(contactEmail) && hasDeclared;
  return (
    <BottomSheet visible={!!notice} onClose={onClose} title={submit.isSuccess ? "Counter-notice sent" : "Send a counter-notice"}>
      <View style={styles.body}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          {submit.isSuccess ? <SealCheck20Icon size={22} color={colors.textMuted} /> : <Scales24Icon size={22} color={colors.textMuted} />}
        </View>
        {submit.isSuccess ? (
          <Text size={14} lineHeight={19.6} color={colors.textMuted}>
            We've sent your counter-notice to our copyright team and the claimant. If it is accepted and the claimant doesn't start court action, your content is restored after 10 business days.
          </Text>
        ) : (
          <>
            <Text size={13} lineHeight={18.2} color={colors.textMuted}>
              For {notice?.workTitle}. Explain why you have the right to use this work, for example you own it, have a licence, or your use is allowed by law.
            </Text>
            <ClaimTextField label="Your statement" value={statement} onChangeText={setStatement} multiline maximumLength={2000} />
            <ClaimTextField label="Contact email" value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maximumLength={254} />
            <ClaimCheckbox checked={hasDeclared} onToggle={() => setHasDeclared((declared) => !declared)} label={COUNTER_NOTICE_DECLARATION} />
            {submit.isError ? <Text size={13} lineHeight={16.9} color={colors.error}>{submit.error instanceof Error ? submit.error.message : "Couldn't send. Try again."}</Text> : null}
            <Button title="Send counter-notice" disabled={!canSubmit} loading={submit.isPending} onPress={() => notice && submit.mutate({ claimId: notice.claimId, input: { statement: statement.trim(), contactEmail: contactEmail.trim(), goodFaith: true } })} />
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 } });

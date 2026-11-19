import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { KeyboardAwareForm } from "@/components/ui/keyboardAwareForm";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { profileQueryKeys } from "@/components/profile/profileQueries.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { usersService } from "@/services/account/users.service";
import { makeThemedStyles, useTheme } from "@/theme";
import { typeScale } from "@/constants/typography.constant";

export function EmailVerificationScreen({ navigation }: MainScreenProps<"EmailVerification">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [hasSentCode, setHasSentCode] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const status = useQuery({ queryKey: profileQueryKeys.myProfile, queryFn: usersService.fetchMyProfile, retry: false });
  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1_000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  const sendCode = useMutation({
    mutationFn: usersService.sendMyEmailVerificationCode,
    onSuccess: ({ resendAfterSeconds }) => {
      setHasSentCode(true);
      setResendSeconds(resendAfterSeconds);
    },
  });
  const confirmCode = useMutation({
    mutationFn: () => usersService.confirmMyEmailVerificationCode(code),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.myProfile });
      navigation.goBack();
    },
  });

  return (
    <Screen>
      <Header title="Verify email" />
      {status.isPending ? <ListSkeleton rows={3} /> : status.isError || !status.data ? (
        <ErrorState error={status.error} message="Couldn't load your account email." onRetry={() => void status.refetch()} retrying={status.isRefetching} />
      ) : (
        <KeyboardAwareForm contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text size={typeScale.lg} weight={600} lineHeight={24} accessibilityRole="header">
              {status.data.emailVerified ? "Your email is verified" : "Verify your email to check out"}
            </Text>
            <Text size={typeScale.sm} lineHeight={20} color={colors.textMuted}>
              {status.data.emailVerified
                ? `${status.data.email ?? "Your account email"} is verified.`
                : `We’ll send a six-digit code to ${status.data.email ?? "your account email"}. Verify it before continuing to payment.`}
            </Text>
            {status.data.emailVerified ? (
              <Button title="Continue" onPress={() => navigation.goBack()} />
            ) : !status.data.email ? (
              <Text size={typeScale.sm} lineHeight={20} color={colors.error} accessibilityRole="alert">
                There is no email address on this account. Contact support to update it before checkout.
              </Text>
            ) : (
              <>
                {hasSentCode ? (
                  <TextField
                    label="6-digit verification code"
                    placeholder="Enter code"
                    value={code}
                    onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    maxLength={6}
                    accessibilityLabel="6-digit verification code"
                  />
                ) : null}
                {sendCode.isError || confirmCode.isError ? (
                  <Text size={typeScale.sm} lineHeight={20} color={colors.error} accessibilityRole="alert">
                    {confirmCode.isError ? "That code couldn't be verified. Check it and try again." : "We couldn't send the code. Try again shortly."}
                  </Text>
                ) : null}
                <Button
                  title={hasSentCode ? "Verify email" : "Send verification code"}
                  disabled={hasSentCode ? code.length !== 6 : false}
                  loading={confirmCode.isPending || (!hasSentCode && sendCode.isPending)}
                  onPress={() => hasSentCode ? confirmCode.mutate() : sendCode.mutate()}
                />
                {hasSentCode ? (
                  <Button
                    variant="subtle"
                    title={resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code"}
                    disabled={resendSeconds > 0 || sendCode.isPending}
                    loading={sendCode.isPending}
                    onPress={() => sendCode.mutate()}
                  />
                ) : null}
              </>
            )}
          </View>
        </KeyboardAwareForm>
      )}
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { flexGrow: 1, padding: 16, justifyContent: "center" },
  card: { gap: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider, borderRadius: 12, backgroundColor: colors.surface },
}));

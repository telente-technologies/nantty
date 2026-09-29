import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AuthStep } from "@/components/auth/authStep";
import { ContactChannelTabs } from "@/components/auth/contactChannelTabs";
import { RoundCheckbox } from "@/components/auth/roundCheckbox";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { ApiError } from "@/errors/api.error";
import type { AuthScreenProps } from "@/navigation/navigation.types";
import { authService } from "@/services/auth.service";
import { useSignUpStore, type SignUpContactChannel } from "@/store/signup.store";
import {
  convertNigerianPhoneNumberToInternationalFormat,
  formatNigerianPhoneNumberForDisplay,
  isValidEmailAddress,
  isValidNigerianPhoneNumber,
} from "@/utils/validators.util";

export function SignUpContactScreen({ navigation }: AuthScreenProps<"SignUpContact">) {
  const { channel, saveLoginInfo, updateSignUpDraft } = useSignUpStore();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const isContactValid = channel === "phone" ? isValidNigerianPhoneNumber(phoneNumber) : isValidEmailAddress(email);

  const switchContactChannel = (nextChannel: SignUpContactChannel) => {
    setErrorMessage(null);
    updateSignUpDraft({ channel: nextChannel });
  };

  const sendVerificationCodeAndContinue = async () => {
    const destination = channel === "phone" ? convertNigerianPhoneNumberToInternationalFormat(phoneNumber) : email.trim().toLowerCase();
    setErrorMessage(null);
    setSending(true);
    try {
      await authService.sendOneTimeCode(destination, "signup");
      updateSignUpDraft({ destination, otpToken: null });
      navigation.navigate("VerifyOtp", { destination, purpose: "signup" });
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "We couldn't send the code. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthStep
      title={channel === "phone" ? "What’s your phone number?" : "What’s your email?"}
      subtitle="We’ll send you a 6-digit code to confirm it’s you."
      actionTitle="Send Code"
      actionDisabled={!isContactValid}
      loading={sending}
      onAction={sendVerificationCodeAndContinue}
    >
      <ContactChannelTabs selectedChannel={channel} onSelectChannel={switchContactChannel} />
      {channel === "phone" ? (
        <TextField
          placeholder="Phone number"
          value={formatNigerianPhoneNumberForDisplay(phoneNumber)}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          accessibilityLabel="Phone number"
          invalid={!!errorMessage}
          left={
            <View style={styles.countryPrefix}>
              <Text size={14} weight={500} lineHeight={16.8}>
                NG +234
              </Text>
              <View style={styles.prefixDivider} />
            </View>
          }
        />
      ) : (
        <TextField
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          autoCapitalize="none"
          accessibilityLabel="Email"
          invalid={!!errorMessage}
        />
      )}
      <RoundCheckbox
        checked={saveLoginInfo}
        onToggle={() => updateSignUpDraft({ saveLoginInfo: !saveLoginInfo })}
        label="Save login info on your device to log in automatically next time."
      />
      {errorMessage ? (
        <Text size={12} weight={500} lineHeight={14.4} color={colors.error} accessibilityRole="alert">
          {errorMessage}
        </Text>
      ) : null}
      {channel === "phone" ? (
        <Text size={12} weight={500} lineHeight={15.6} color={colors.textSubtle} align="center">
          Your phone number may be used to connect you to people you may know, improve ads, and more, depending on your settings.{" "}
          <Text size={12} weight={500} lineHeight={15.6}>
            Learn more
          </Text>
        </Text>
      ) : null}
    </AuthStep>
  );
}

const styles = StyleSheet.create({
  countryPrefix: { flexDirection: "row", alignItems: "center", gap: 12 },
  prefixDivider: { width: 1, height: 20, backgroundColor: colors.divider },
});

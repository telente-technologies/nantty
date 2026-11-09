import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { LegalText } from "@/components/auth/legalText";
import { Apple24Icon, Google24Icon, UserCircle24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { KeyboardAwareForm } from "@/components/ui/keyboardAwareForm";
import { Screen } from "@/components/ui/screen";
import { SocialBirthdayPrompt } from "@/components/auth/socialBirthdayPrompt";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { AuthScreenProps } from "@/navigation/navigation.types";
import { useSocialSignIn } from "@/hooks/useSocialSignIn.hook";
import { useGuestSessionStore } from "@/store/guestSession.store";

const photo = require("../../../assets/images/onboardingMarketPhoto.jpg");
const ROWS = [-43, -96, -43];
const SIGN_IN_OPTION_ICON_GAP = 8;

export function OnboardingScreen({ navigation, route }: AuthScreenProps<"Onboarding">) {
  const { colors } = useTheme();
  const mode = route.params?.mode ?? "signup";
  const {
    isAppleSignInAvailable,
    providerSigningIn,
    failureMessage,
    birthdayChallenge,
    isSubmittingBirthday,
    signInWithProvider,
    completeWithBirthday,
    cancelBirthdayChallenge,
  } = useSocialSignIn();
  const startBrowsingAsGuest = useGuestSessionStore((s) => s.startBrowsingAsGuest);
  const isDismissible = route.params?.dismissible === true;

  const dismissOnboarding = () => {
    cancelBirthdayChallenge();
    if (isDismissible) navigation.getParent()?.goBack();
    else startBrowsingAsGuest();
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isDismissible ? "Not now" : "Skip"}
          accessibilityHint={isDismissible ? "Closes sign in" : "Browse Nantty without an account"}
          hitSlop={8}
          disabled={isSubmittingBirthday}
          onPress={dismissOnboarding}
          style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
        >
          <Text size={14} weight={500} lineHeight={16.8} color={colors.text}>
            {isDismissible ? "Not now" : "Skip"}
          </Text>
        </Pressable>
      </View>
      <KeyboardAwareForm contentContainerStyle={styles.content} bounces={false}>
        <View style={styles.rows} accessible={false} importantForAccessibility="no-hide-descendants">
          {ROWS.map((offset, row) => (
            <View key={row} style={[styles.row, { marginLeft: offset }]}>
              {Array.from({ length: 5 }, (_, i) => (
                <Image key={i} source={photo} style={styles.photo} contentFit="cover" />
              ))}
            </View>
          ))}
        </View>

        <View style={styles.heading}>
          <Text size={16} weight={500} lineHeight={19.2} align="center" accessibilityRole="header">
            Discover real sellers around you
          </Text>
          <Text size={14} lineHeight={16.8} color={colors.textSubtle} align="center">
            Shop real sellers, pay safely with escrow.
          </Text>
        </View>

        <View style={styles.buttons}>
          {birthdayChallenge ? (
            <SocialBirthdayPrompt
              provider={birthdayChallenge.provider}
              loading={isSubmittingBirthday}
              failureMessage={failureMessage}
              onContinue={completeWithBirthday}
              onCancel={cancelBirthdayChallenge}
            />
          ) : (
            <>
              {isAppleSignInAvailable ? (
                <Button
                  variant="outline"
                  title="Continue with Apple"
                  icon={<Apple24Icon />}
                  iconGap={SIGN_IN_OPTION_ICON_GAP}
                  style={styles.signInOption}
                  loading={providerSigningIn === "apple"}
                  disabled={providerSigningIn !== null}
                  onPress={() => signInWithProvider("apple")}
                />
              ) : null}
              <Button
                variant="outline"
                title="Continue with Google"
                icon={<Google24Icon />}
                iconGap={SIGN_IN_OPTION_ICON_GAP}
                style={styles.signInOption}
                loading={providerSigningIn === "google"}
                disabled={providerSigningIn !== null}
                onPress={() => signInWithProvider("google")}
              />
              <Button
                variant="brand"
                title="Use email"
                icon={<UserCircle24Icon />}
                iconGap={SIGN_IN_OPTION_ICON_GAP}
                style={[styles.signInOption, { borderColor: colors.primarySolid }]}
                disabled={providerSigningIn !== null}
                onPress={() => (mode === "login" ? navigation.navigate("Login") : navigation.navigate("SignUpContact"))}
              />
              {failureMessage ? (
                <Text size={12} lineHeight={14.4} color={colors.error} align="center" accessibilityRole="alert">
                  {failureMessage}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.footer}>
          <LegalText />
          {!birthdayChallenge ? <View style={styles.switch}>
            <Text size={12} weight={500} lineHeight={14.4}>
              {mode === "login" ? "Don’t have an account?" : "Already have an account?"}
            </Text>
            <Text
              size={14}
              weight={500}
              lineHeight={16.8}
              color={colors.primary}
              accessibilityRole="link"
              onPress={() => navigation.setParams({ mode: mode === "login" ? "signup" : "login" })}
            >
              {mode === "login" ? "Sign up" : "Log in"}
            </Text>
          </View> : null}
        </View>
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { height: 44, paddingHorizontal: 16, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" },
  skip: { minHeight: 32, paddingHorizontal: 4, justifyContent: "center" },
  skipPressed: { opacity: 0.6 },
  content: { paddingBottom: 24 },
  signInOption: { borderWidth: 1 },
  rows: { marginTop: 74, gap: 16, overflow: "hidden" },
  row: { flexDirection: "row", gap: 8 },
  photo: { width: 100, height: 56, borderRadius: 4 },
  heading: { marginTop: 32, paddingHorizontal: 40, gap: 8, alignItems: "center" },
  buttons: { marginTop: 28, paddingHorizontal: 16, gap: 16 },
  footer: { marginTop: 40, paddingHorizontal: 16, gap: 28, alignItems: "center" },
  switch: { flexDirection: "row", alignItems: "center", gap: 4 },
});

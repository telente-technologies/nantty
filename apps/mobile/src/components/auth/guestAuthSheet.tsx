import { StyleSheet, View } from "react-native";

import { Apple24Icon, Google24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { SocialBirthdayPrompt } from "@/components/auth/socialBirthdayPrompt";
import { Text } from "@/components/ui/text";
import { useSocialSignIn } from "@/hooks/useSocialSignIn.hook";
import { usePendingAuthIntentStore } from "@/store/pendingAuthIntent.store";
import { makeThemedStyles } from "@/theme";
import { openAuthFlowThenReturn } from "@/utils/requireAuth.util";

export function GuestAuthSheet() {
  const styles = useStyles();
  const reason = usePendingAuthIntentStore((s) => s.signInPromptReason);
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

  const dismissAndForgetAction = () => {
    cancelBirthdayChallenge();
    const { closeSignInPrompt, discardPendingIntent } = usePendingAuthIntentStore.getState();
    closeSignInPrompt();
    discardPendingIntent();
  };

  return (
    <BottomSheet
      visible={reason !== null}
      onClose={dismissAndForgetAction}
      scrollable={birthdayChallenge !== null}
      dismissible={!isSubmittingBirthday}
      title={`Sign in to ${reason ?? "continue"}`}
      subtitle="Create a free account or sign in. We'll bring you back here and finish what you started."
    >
      <View style={styles.body}>
        {birthdayChallenge ? (
          <SocialBirthdayPrompt
            provider={birthdayChallenge.provider}
            loading={isSubmittingBirthday}
            failureMessage={failureMessage}
            onContinue={completeWithBirthday}
            onCancel={cancelBirthdayChallenge}
          />
        ) : null}
        {!birthdayChallenge ? (
          <>
            {isAppleSignInAvailable ? (
              <Button variant="outline" title="Continue with Apple" icon={<Apple24Icon />} loading={providerSigningIn === "apple"} disabled={providerSigningIn !== null} onPress={() => signInWithProvider("apple")} />
            ) : null}
            <Button variant="outline" title="Continue with Google" icon={<Google24Icon />} loading={providerSigningIn === "google"} disabled={providerSigningIn !== null} onPress={() => signInWithProvider("google")} />
            <Button title="Sign in" disabled={providerSigningIn !== null} onPress={() => { cancelBirthdayChallenge(); openAuthFlowThenReturn("login"); }} />
            <Button variant="subtle" title="Create account" disabled={providerSigningIn !== null} onPress={() => { cancelBirthdayChallenge(); openAuthFlowThenReturn("signup"); }} />
            {failureMessage ? (
              <Text size={12} style={styles.failure} align="center" accessibilityRole="alert">
                {failureMessage}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 10 },
  failure: { color: colors.error },
}));
